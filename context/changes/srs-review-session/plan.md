# Spaced Repetition Review Session (S-04) — Plan implementacji

## Przegląd

Implementacja sesji powtórek opartej na algorytmie FSRS v6 (biblioteka `ts-fsrs`). Użytkownik wchodzi na `/review`, dostaje kolejkę max 20 fiszek należnych dziś, przegląda je flip-by-flip (klik/spacja), ocenia każdą na 4-punktowej skali (Again/Hard/Good/Easy), a algorytm liczy nowy termin następnej powtórki i zapisuje wynik do DB.

## Analiza stanu obecnego

- Trasa `/review` już chroniona w `src/middleware.ts:4` — brak pracy z auth
- DB (`supabase/migrations/20260618000000_flashcard_schema.sql`) ma wszystkie pola FSRS poza `learning_steps`; `elapsed_days` (deprecated) zostaje bez zmian
- `src/types.ts` zawiera tylko `Flashcard` bez pól SR — potrzebne nowe interfejsy
- `ts-fsrs` nie zainstalowana — `npm install ts-fsrs` wymagane
- Wzorzec API: `src/pages/api/flashcards/[id].ts` — do naśladowania

## Pożądany stan końcowy

Użytkownik może wejść na `/review`, zobaczyć przód pierwszej należnej fiszki, kliknąć aby odsłonić tył, ocenić kartę (Again/Hard/Good/Easy — przy każdym przycisku widoczny interwał: "za 10 min / 1 dzień / 3 dni / 2 tyg."), przejść do następnej i na końcu sesji zobaczyć "Gotowe na dziś! Wróć za X h".

### Kluczowe odkrycia:

- `src/middleware.ts:4` — `/review` jest w `PROTECTED_PAGE_ROUTES`, auth gotowy
- `supabase/migrations/20260618000000_flashcard_schema.sql` — brakuje tylko `learning_steps`; indeks `(user_id, due)` już istnieje, wspiera query "karty należne dziś"
- `src/pages/api/flashcards/[id].ts` — wzorzec endpointu: `createClient → user → supabase query → JSON response`
- `ts-fsrs` API: `fsrs()` → `scheduler.repeat(card, now)` (preview) + `scheduler.next(card, now, rating)` (zapis oceny); `TypeConvert.card()` konwertuje DB strings → Date/enum
- `src/pages/flashcards.astro` — wzorzec strony: `<Layout> + <ReactComponent client:load />`

## Czego NIE robimy

- Rollback (`scheduler.rollback()`) — poza zakresem MVP
- Historia powtórek (tabela review_log) — poza zakresem MVP
- Własne parametry FSRS (FSRSParameters) — używamy domyślnych
- Konfigurowalny limit sesji — zawsze max 20
- Mobilne gesty swipe — tylko klik/klawiatura
- Usuwanie `elapsed_days` — pole zostaje w DB

## Podejście do implementacji

Trzy fazy przyrostowe: (1) foundation — migracja + deps + typy, (2) backend API — dwa endpointy, (3) frontend — strona Astro + React island. Każda faza jest niezależnie weryfikowalna przed przejściem dalej.

Preview interwałów wyliczamy server-side w GET `/api/review/session` (repeat() per karta, format human-readable) i przesyłamy do klienta — brak potrzeby bundlowania ts-fsrs po stronie przeglądarki.

## Krytyczne szczegóły implementacji

**TypeConvert.card() wymaga `elapsed_days: 0`** — mimo że pole jest deprecated w ts-fsrs, interfejs wejściowy nadal go wymaga. Pomiń lub ustaw na 0.

**Format interwału z `repeat()` rezultatu** — `scheduled_days` dla Again może wynosić 0 (kilka minut), więc interwał liczymy z różnicy `resultCard.due - now`:

```typescript
function formatInterval(due: Date, now: Date): string {
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.round(diffMs / 86_400_000);
  if (diffD === 1) return '1 dzień';
  if (diffD < 7) return `${diffD} dni`;
  const weeks = Math.round(diffD / 7);
  if (weeks === 1) return '1 tydzień';
  if (weeks < 5) return `${weeks} tygodnie`;
  return `${Math.round(diffD / 30)} mies.`;
}
```

**Migracja przez MCP** — `supabase db push` może być blokowany przez AVG; używaj `apply_migration` przez MCP (project ref: `uebytioeeilxnsurhrwg`).

---

## Faza 1: Foundation (migracja, deps, typy)

### Przegląd

Zamknięcie 3 luk zidentyfikowanych w research: dodanie kolumny `learning_steps`, instalacja `ts-fsrs`, rozszerzenie typów TypeScript.

### Wymagane zmiany:

#### 1. Migracja Supabase

**Plik**: `supabase/migrations/20260714000000_add_learning_steps.sql`

**Cel**: Dodać brakującą kolumnę `learning_steps` wymaganą przez ts-fsrs `Card` interface. Additive change, nie breaking.

**Kontrakt**: `ALTER TABLE flashcards ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0;`

Zastosować przez MCP `apply_migration` (nie `supabase db push`).

#### 2. Instalacja ts-fsrs

**Plik**: `package.json` (via npm)

**Cel**: Dodać bibliotekę `ts-fsrs` v5.x jako zależność produkcyjną.

**Kontrakt**: `npm install ts-fsrs` — pakiet w `dependencies`, nie `devDependencies`.

#### 3. Typy TypeScript

**Plik**: `src/types.ts`

**Cel**: Dodać interfejsy dla sesji powtórek. Nie modyfikować istniejącego `Flashcard` — nowe typy są specyficzne dla review flow.

**Kontrakt**: Nowe interfejsy na końcu pliku:

```typescript
export interface FlashcardForReview {
  id: string;
  front: string;
  back: string;
  // FSRS state — raw DB values (strings/numbers), TypeConvert.card() przetworzy je w API
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;        // 0=New 1=Learning 2=Review 3=Relearning
  last_review: string | null;
  // Pre-computed preview intervals (server-side repeat())
  preview: {
    again: string;      // np. "10 min"
    hard: string;       // np. "1 dzień"
    good: string;       // np. "3 dni"
    easy: string;       // np. "2 tygodnie"
  };
}

export interface ReviewSessionResponse {
  cards: FlashcardForReview[];
  next_due: string | null;  // ISO timestamp najbliższej niedostępnej jeszcze karty
}

export type ReviewRating = 1 | 2 | 3 | 4;  // Again=1 Hard=2 Good=3 Easy=4
```

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Migracja aplikuje się czysto przez MCP apply_migration
- `npm ls ts-fsrs` pokazuje zainstalowaną wersję
- `npm run lint` przechodzi (nowe typy nie łamią istniejącego kodu)
- `npm run build` przechodzi (typecheck w buildzie)

#### Weryfikacja ręczna:

- Kolumna `learning_steps` widoczna w Supabase Table Editor
- Nowe interfejsy dostępne bez błędów w IDE

**Uwaga implementacyjna**: Po zakończeniu fazy 1 i przejściu automatycznych weryfikacji, zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Faza 2: Backend API

### Przegląd

Dwa nowe endpointy w katalogu `src/pages/api/review/`: GET session zwraca due karty z preview, POST zapisuje ocenę użytkownika.

### Wymagane zmiany:

#### 1. GET /api/review/session

**Plik**: `src/pages/api/review/session.ts`

**Cel**: Zwrócić max 20 fiszek należnych dziś (due ≤ now) wraz z pre-wyliczonymi interwałami preview dla każdego z 4 ratingów oraz timestamp następnej karty poza kolejką.

**Kontrakt**:

- Auth: `context.locals.user` → 401 jeśli brak (wzorzec z `[id].ts`)
- Query 1: `SELECT id, front, back, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review FROM flashcards WHERE due <= now() ORDER BY due ASC LIMIT 20`; RLS filtruje per user
- Query 2: `SELECT MIN(due) as next_due FROM flashcards WHERE due > now()` (osobny zapytanie lub `.select("due").gt("due", now).order("due").limit(1)`)
- Per karta: `TypeConvert.card({ ...raw, elapsed_days: 0 })` → `scheduler.repeat(card, now)` → formatInterval per Rating
- Response: `{ cards: FlashcardForReview[], next_due: string | null }`
- Błędy: 401/500 z `{ error: "..." }` po polsku

#### 2. POST /api/review

**Plik**: `src/pages/api/review/index.ts`

**Cel**: Przyjąć ocenę użytkownika dla jednej fiszki, wyliczyć nowy stan FSRS, zaktualizować rekord w DB.

**Kontrakt**:

- Auth: `context.locals.user` → 401 jeśli brak
- Body: `{ card_id: string, rating: ReviewRating }` — waliduj że rating ∈ {1,2,3,4}
- Fetch aktualnego stanu karty: `SELECT [wszystkie pola FSRS] FROM flashcards WHERE id = card_id` (RLS zapewnia własność)
- `TypeConvert.card({ ...raw, elapsed_days: 0 })` → `scheduler.next(card, new Date(), rating as Rating)` → `result.card`
- UPDATE: `{ due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review }` gdzie `id = card_id`
- Response: `{ updated: true }` (HTTP 200) lub `{ error: "..." }` (404/400/500)

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi dla nowych plików
- `npm run build` przechodzi (typecheck)

#### Weryfikacja ręczna:

- `GET /api/review/session` z sesją zalogowanego użytkownika zwraca JSON z `cards` i `next_due`
- Każda karta w `cards` ma pole `preview` z niepustymi stringami
- `POST /api/review` z `{ card_id, rating: 3 }` zwraca `{ updated: true }` i zmienia `due` w DB

**Uwaga implementacyjna**: Zatrzymaj się po fazie 2 na ręczne testy endpointów przed fazą 3.

---

## Faza 3: Frontend (strona + React island)

### Przegląd

Strona `/review` zbudowana wzorcem `flashcards.astro` — Astro wrapper + React island z logiką stanu sesji.

### Wymagane zmiany:

#### 1. Strona Astro

**Plik**: `src/pages/review.astro`

**Cel**: Kontener strony dla sesji powtórek. Wzorzec identyczny z `flashcards.astro`.

**Kontrakt**: `<Layout title="Sesja powtórek"> <ReviewSession client:load /> </Layout>`

#### 2. React island — sesja powtórek

**Plik**: `src/components/flashcards/ReviewSession.tsx`

**Cel**: Zarządzać stanem sesji (ładowanie → front → back → done) i komunikacją z API.

**Kontrakt**:

Stan lokalny komponentu:
- `phase: 'loading' | 'front' | 'back' | 'done'`
- `cards: FlashcardForReview[]`
- `currentIndex: number`
- `nextDue: string | null`

Przejścia stanu:
- mount → `fetch GET /api/review/session` → jeśli `cards.length === 0`: phase='done'; else: phase='front'
- phase='front' + (klik na kartę lub `keydown Space`) → phase='back' (ujawnienie tył + przyciski)
- phase='back' + klik przycisku oceny → `fetch POST /api/review` → sprawdź `response.ok && !response.redirected` przed `.json()` (middleware zwraca 302 HTML zamiast 401 przy wygaśnięciu sesji — cicha awaria bez tego sprawdzenia) → `currentIndex++` → jeśli więcej kart: phase='front'; else: phase='done'
- Jeśli `response.redirected === true`: pokaż komunikat "Sesja wygasła, zaloguj się ponownie" i przekieruj na `/auth/signin`

UI elementów:
- phase='front': wyświetl `card.front`, przycisk/hint "Kliknij aby odsłonić"
- phase='back': wyświetl `card.front` + `card.back`, 4 przyciski z etykietami `Again (${preview.again})`, `Hard (${preview.hard})`, `Good (${preview.good})`, `Easy (${preview.easy})`
- phase='done': "Gotowe na dziś!" + jeśli `nextDue !== null`: "Wróć za X" (sformatowany czas)
- phase='loading': spinner lub "Ładowanie..."
- Licznik postępu: `{currentIndex}/{cards.length}`

Obsługa klawiatury (useEffect na 'keydown'):
- `Space` lub `Enter` gdy phase='front' → flip
- `1`/`2`/`3`/`4` gdy phase='back' → ocena Again/Hard/Good/Easy

Stylowanie: Tailwind, `cn()` z `@/lib/utils`, `Button` z `@/components/ui/button` dla przycisków oceny.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm run lint` przechodzi
- `npm run build` przechodzi (typecheck + build)

#### Weryfikacja ręczna:

- `/review` ładuje się poprawnie dla zalogowanego użytkownika
- Widoczny przód pierwszej karty i licznik "1/N"
- Kliknięcie lub Spacja odsłania tył i 4 przyciski z interwałami
- Kliknięcie "Good" przechodzi do kolejnej karty (lub ekranu done)
- Klawisze 1-4 działają jako skróty oceny
- Po ostatniej karcie widoczny ekran "Gotowe na dziś!" z czasem powrotu
- Nawigacja z dashboardu lub /flashcards do /review działa

---

## Strategia testowania

### Testy ręczne — pełny flow:

1. Zaloguj się, upewnij że masz fiszki w DB z `due <= now()` (nowe fiszki mają domyślne `due = now()`)
2. Wejdź na `/review` — powinna się załadować sesja
3. Przejdź przez 3-4 karty, używając różnych ocen (1=Again, 3=Good, 4=Easy)
4. Sprawdź w Supabase, że `due` i inne pola FSRS zmieniły się po ocenach
5. Sprawdź że "Again" daje krótszy interwał niż "Good"
6. Po przejściu wszystkich kart — ekran "Gotowe na dziś!"
7. Test empty state: jeśli brak due kart, ekran done pojawia się od razu z `next_due`

### Przypadki brzegowe:

- Użytkownik bez fiszek → empty state bez `next_due`
- Błąd sieci w trakcie POST → błąd nie blokuje UI (pokaż toast lub prosty komunikat)

## Referencje

- Badania: `context/changes/srs-review-session/research.md`
- Biblioteka SR: `context/changes/srs-review-session/research-sr-libraries.md`
- ts-fsrs API: `context/changes/srs-review-session/ts-fsrs-api-docs.md`
- Wzorzec endpointu: `src/pages/api/flashcards/[id].ts`
- Wzorzec strony: `src/pages/flashcards.astro`
- Schemat DB: `supabase/migrations/20260618000000_flashcard_schema.sql`

---

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po zakończeniu kroku.

### Phase 1: Foundation

#### Automatyczne

- [x] 1.1 Migracja applies czysto (apply_migration MCP) — ee3cc1b
- [x] 1.2 `npm ls ts-fsrs` pokazuje zainstalowany pakiet — ee3cc1b
- [x] 1.3 `npm run lint` przechodzi — ee3cc1b
- [x] 1.4 `npm run build` przechodzi (nowe typy) — ee3cc1b

#### Ręczne

- [x] 1.5 Kolumna `learning_steps` widoczna w Supabase Table Editor — ee3cc1b

### Phase 2: Backend API

#### Automatyczne

- [x] 2.1 `npm run lint` przechodzi dla nowych plików API
- [x] 2.2 `npm run build` przechodzi

#### Ręczne

- [x] 2.3 GET /api/review/session zwraca karty z preview
- [x] 2.4 POST /api/review aktualizuje due i pola SR w DB

### Phase 3: Frontend

#### Automatyczne

- [x] 3.1 `npm run lint` przechodzi
- [x] 3.2 `npm run build` przechodzi

#### Ręczne

- [x] 3.3 /review ładuje się, pokazuje przód pierwszej karty
- [x] 3.4 Flip działa (klik + Spacja)
- [x] 3.5 4 przyciski z interwałami widoczne po flipie
- [x] 3.6 Ocena przechodzi do następnej karty
- [x] 3.7 Klawisze 1-4 działają jako skróty
- [x] 3.8 Ekran "Gotowe na dziś!" z czasem powrotu
