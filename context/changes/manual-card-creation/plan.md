# Manual Card Creation Implementation Plan

## Overview

Build the S-03 vertical slice: dashboard jako centrum — formularz ręcznego tworzenia fiszki (przód + tył), zapis do Supabase przez istniejący endpoint, inline baner sukcesu, link do generowania AI oraz lista kolekcji użytkownika aktualizowana bez przeładowania strony.

## Current State Analysis

- `src/middleware.ts:4`: `/dashboard` chroniony middlewarem — no per-route auth guard needed
- `src/pages/api/flashcards/index.ts`: endpoint `POST /api/flashcards` już istnieje (S-01 Phase 3). Przyjmuje `{ cards: FlashcardDraft[] }`, robi bulk insert do Supabase z `user_id`
- `src/types.ts`: `FlashcardDraft` i `Flashcard` zdefiniowane
- `src/pages/dashboard.astro`: strona dashboardu z success bannerem dla `?saved=N`; pobiera `user` z `Astro.locals`
- `src/lib/supabase.ts`: `createClient(requestHeaders, cookies)` — działa w Astro frontmatter przez `Astro.request.headers` i `Astro.cookies`
- React island pattern: `client:load`, props z `.astro` parent, `useState` dla stanu lokalnego

### Key Discoveries:

- `src/pages/api/flashcards/index.ts`: endpoint obsługuje tablicę fiszek — dla jednej fiszki wysyłamy `{ cards: [{ front, back }] }`
- Tabela `flashcards` ma kolumny: `id`, `user_id`, `front`, `back`, `created_at`, `updated_at` (F-01 migration)
- `src/pages/dashboard.astro`: użytkownik dostępny przez `const { user } = Astro.locals` — `user.id` dostępny w SSR do query Supabase

## Desired End State

Zalogowany użytkownik na `/dashboard`:
1. Widzi formularz "Utwórz fiszkę" z polami Przód i Tył
2. Wypełnia pola i klika "Zapisz fiszkę"
3. Widzî baner sukcesu "Fiszka zapisana!" i pusty formularz gotowy na kolejną fiszkę
4. Widzi nową fiszkę natychmiast na liście poniżej formularza (bez przeładowania)
5. Może kliknąć "Generuj z AI" → przejść do `/generate`

## What We're NOT Doing

- Edycja istniejących fiszek (S-04)
- Usuwanie fiszek (S-04)
- Paginacja listy fiszek
- Filtrowanie / sortowanie listy
- Wyświetlanie stanu spaced repetition per fiszka
- Walidacja duplikatów

## Implementation Approach

Dwie fazy w kolejności zależności:

1. **ManualCardForm island** — komponent React z formularzem (front/back), submit do `/api/flashcards`, inline baner sukcesu, link "Generuj z AI". Dashboard montuje island bez danych listy.
2. **Dashboard enhancement** — SSR fetch kolekcji użytkownika w `dashboard.astro`, przekazanie jako props do island; island rozszerzona o `initialCards`, zarządza listą lokalnie i dokłada nową fiszkę po zapisie bez przeładowania.

---

## Phase 1: ManualCardForm Island

### Overview

Nowy komponent React `ManualCardForm` z formularzem ręcznego tworzenia fiszki. Montowany na dashboardzie. Obsługuje submit, baner sukcesu i link do /generate. Lista kart odkładana do Phase 2.

### Changes Required:

#### 1. ManualCardForm React island

**File**: `src/components/flashcards/ManualCardForm.tsx` (new)

**Intent**: Island zarządzający formularzem przód/tył — submit do API, inline baner sukcesu, clear formularza po zapisie, link do /generate.

**Contract**:
- Props: brak (Phase 1); Phase 2 doda `initialCards: Flashcard[]`
- State: `front` (string), `back` (string), `isLoading` (boolean), `success` (boolean), `error` (string | null)
- Textarea "Przód": controlled, `rows={3}`, placeholder "Pytanie lub pojęcie..."
- Textarea "Tył": controlled, `rows={4}`, placeholder "Odpowiedź lub definicja..."
- Submit button: disabled gdy `isLoading || front.trim().length === 0 || back.trim().length === 0`; spinner (Loader2 z lucide-react) gdy `isLoading`; label "Zapisz fiszkę"
- On submit: `fetch("/api/flashcards", { method: "POST", headers: ..., body: JSON.stringify({ cards: [{ front, back }] }) })`; na sukces: `setFront("")`, `setBack("")`, `setSuccess(true)`, `setError(null)`; na błąd: `setError(...)`
- Baner sukcesu: renderowany gdy `success === true`, znika gdy użytkownik zaczyna pisać w którymkolwiek polu (onChange czyści `success`); styl: zielony, spójny z dashboardem
- Baner błędu: czerwony, powyżej formularza
- Link "Generuj z AI →": `<a href="/generate">` powyżej formularza, styl secondary
- `cn()` z `@/lib/utils` do class merging; `FlashcardDraft` z `@/types`

#### 2. Dashboard — montowanie island

**File**: `src/pages/dashboard.astro` (modify)

**Intent**: Zamontować `ManualCardForm` na dashboardzie jako główną sekcję interaktywną.

**Contract**: Import `ManualCardForm` z `@/components/flashcards/ManualCardForm`. Dodać `<ManualCardForm client:load />` w body dashboardu, poniżej istniejącego success bannera `?saved=N`, zastępując placeholder "This page is only for authenticated users."

### Success Criteria:

#### Automated Verification:

- Type checking i linting: `npm run lint`
- Production build: `npm run build`

#### Manual Verification:

- Dashboard renderuje formularz z polami Przód i Tył
- Oba pola puste → przycisk "Zapisz fiszkę" disabled
- Wypełnienie jednego pola → przycisk nadal disabled (oba wymagane)
- Submit z wypełnionymi polami → spinner, potem baner sukcesu, pola wyczyszczone
- Zaczynanie pisania po sukcesie → baner znika
- Link "Generuj z AI" prowadzi do /generate

**Implementation Note**: Po przejściu automated verification, pauza na manualne potwierdzenie przed Phase 2.

---

## Phase 2: Dashboard Enhancement — Card List

### Overview

Rozszerzenie dashboardu o SSR fetch kolekcji użytkownika i przekazanie do island. Rozszerzenie `ManualCardForm` o props `initialCards` i renderowanie listy fiszek poniżej formularza — nowe fiszki dokładane do stanu lokalnie po zapisie.

### Changes Required:

#### 1. SSR fetch kolekcji w dashboard.astro

**File**: `src/pages/dashboard.astro` (modify)

**Intent**: Pobrać fiszki zalogowanego użytkownika z Supabase w server-side frontmatter i przekazać do island.

**Contract**: W frontmatter:
```typescript
const supabase = createClient(Astro.request.headers, Astro.cookies);
const { data: flashcards } = supabase
  ? await supabase.from("flashcards").select("id, front, back, created_at").eq("user_id", user.id).order("created_at", { ascending: false })
  : { data: [] };
```
Przekazać jako prop: `<ManualCardForm initialCards={flashcards ?? []} client:load />`

#### 2. Rozszerzenie ManualCardForm o listę kart

**File**: `src/components/flashcards/ManualCardForm.tsx` (modify)

**Intent**: Dodać `initialCards` prop i sekcję listy fiszek poniżej formularza. Po zapisie nowa fiszka dokładana na początku listy bez przeładowania.

**Contract**:
- Dodać import `Flashcard` z `@/types`
- Props: `{ initialCards?: Flashcard[] }`
- Nowy state: `cards` (Flashcard[]) inicjalizowany z `initialCards ?? []`
- Po udanym zapisie: dokładać `{ id: crypto.randomUUID(), front, back, user_id: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }` na początku `cards` (optymistyczny update — `id` tymczasowe, nie wpływa na dalsze operacje)
- Sekcja listy: renderowana gdy `cards.length > 0`; nagłówek "Twoje fiszki (N)"; każda karta pokazuje `front` pogrubione i `back` poniżej; styl: karty glassmorphism spójne z resztą UI
- Gdy `cards.length === 0`: komunikat "Nie masz jeszcze żadnych fiszek. Utwórz pierwszą powyżej."

### Success Criteria:

#### Automated Verification:

- Type checking i linting: `npm run lint`
- Production build: `npm run build`

#### Manual Verification:

- Dashboard pokazuje listę istniejących fiszek użytkownika (lub komunikat "brak fiszek")
- Po zapisie nowej fiszki: pojawia się na początku listy bez przeładowania
- Licznik w nagłówku listy aktualizuje się po dodaniu
- Przy pierwszej fiszce: lista zastępuje komunikat "brak fiszek"

**Implementation Note**: Po przejściu automated verification, pauza na manualne potwierdzenie.

---

## Testing Strategy

### Manual Testing Steps:

1. Uruchom dev server: `npm run dev`
2. Zaloguj się → otwórz `/dashboard`
3. Sprawdź że formularz renderuje się z polami Przód i Tył
4. Zostaw oba pola puste → sprawdź że przycisk disabled
5. Wypełnij tylko Przód → sprawdź że przycisk nadal disabled
6. Wypełnij oba pola → kliknij "Zapisz fiszkę" → sprawdź baner sukcesu i wyczyszczone pola
7. Sprawdź że nowa fiszka pojawia się na liście poniżej
8. Zacznij pisać w polu → baner znika
9. Kliknij "Generuj z AI" → sprawdź redirect na /generate
10. Odśwież stronę → sprawdź że fiszka jest na liście (persisted w DB)
11. Sprawdź w Supabase dashboard że fiszka jest w tabeli `flashcards` z poprawnym `user_id`

## References

- Roadmap: `context/foundation/roadmap.md` — S-03
- Istniejący endpoint: `src/pages/api/flashcards/index.ts`
- Wzorzec island: `src/components/flashcards/GenerateForm.tsx`
- Supabase client: `src/lib/supabase.ts`
- Typy: `src/types.ts`
- Dashboard: `src/pages/dashboard.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: ManualCardForm Island

#### Automated

- [x] 1.1 Type checking i linting: `npm run lint` — e1c522a
- [x] 1.2 Production build: `npm run build` — e1c522a

#### Manual

- [x] 1.3 Dashboard renderuje formularz z polami Przód i Tył — e1c522a
- [x] 1.4 Oba pola puste → przycisk disabled — e1c522a
- [x] 1.5 Submit z wypełnionymi polami → baner sukcesu, pola wyczyszczone — e1c522a
- [x] 1.6 Pisanie po sukcesie → baner znika — e1c522a
- [x] 1.7 Link "Generuj z AI" prowadzi do /generate — e1c522a

### Phase 2: Dashboard Enhancement — Card List

#### Automated

- [ ] 2.1 Type checking i linting: `npm run lint`
- [ ] 2.2 Production build: `npm run build`

#### Manual

- [ ] 2.3 Dashboard pokazuje listę istniejących fiszek
- [ ] 2.4 Nowa fiszka pojawia się na liście bez przeładowania
- [ ] 2.5 Licznik w nagłówku aktualizuje się po dodaniu
- [ ] 2.6 Odświeżenie strony — fiszka nadal na liście (persisted)
- [ ] 2.7 Fiszka widoczna w Supabase z poprawnym user_id
