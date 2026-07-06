# Flashcard Edit and Delete — Plan implementacji

## Przegląd

Budujemy stronę `/flashcards` z listą zapisanych fiszek użytkownika. Każdą fiszkę można edytować inline (klik → textareas) lub usunąć z Undo (optimistic UI, DELETE po 5s). Lista sortowalna przez użytkownika. Dodajemy globalny nav bar we wszystkich chronionych stronach.

## Analiza stanu obecnego

- `src/pages/api/flashcards/index.ts` — ma tylko `POST`; brak `GET` do pobierania listy
- `src/pages/api/flashcards/[id].ts` — nie istnieje; brak endpointów dla pojedynczej fiszki
- `src/pages/flashcards.astro` — nie istnieje; trasa jest chroniona przez middleware (`PROTECTED_PAGE_ROUTES` linia 4 w `src/middleware.ts`), ale plik brakuje
- `src/layouts/Layout.astro` — brak nav baru; komponent ma dostęp do `Astro.locals.user`
- `src/pages/dashboard.astro` — ma inline blok z emailem użytkownika + logout; zostanie usunięty po dodaniu nav baru
- `src/types.ts` — `Flashcard` (z `id`, `user_id`, `front`, `back`, `created_at`, `updated_at`) już istnieje — gotowe

## Pożądany stan końcowy

Zalogowany użytkownik wchodzi na `/flashcards`, widzi listę swoich fiszek posortowaną (może zmienić sortowanie), może kliknąć fiszkę żeby ją edytować inline (front/back + walidacja), może usunąć fiszkę z możliwością cofnięcia w ciągu 5 sekund. Globalny nav bar widoczny na wszystkich chronionych stronach.

### Kluczowe odkrycia:

- `src/pages/api/flashcards/index.ts:6` — wzorzec autoryzacji: `context.locals.user`, supabase client przez `createClient(context.request.headers, context.cookies)` — powielić w nowym endpoincie
- `supabase/migrations/20260618000000_flashcard_schema.sql` — RLS automatycznie filtruje po `user_id`; wystarczy wywołać query bez ręcznego `WHERE user_id = ?`
- `src/types.ts:6-11` — `Flashcard` type gotowy; nie trzeba rozszerzać
- `src/components/flashcards/GenerateForm.tsx` — wzorzec inline edit (click → textarea, Zapisz/Anuluj) już istnieje — powielić styl UX
- `src/components/flashcards/ManualCardForm.tsx` — limity znaków: front 500, back 2000 — zachować te same dla edycji

## Czego NIE robimy

- Paginacja — MVP zakłada dziesiątki kart; `SELECT *` bez LIMIT
- Bulk delete/edit — operacje tylko per-karta
- Soft delete w DB — Undo działa przez frontend timer, bez zmian schematu
- Wyszukiwanie/filtrowanie tekstu — tylko sortowanie
- Własny komponent Toast — prosty div z animacją Tailwind
- Zmiana schematu DB — tabela `flashcards` jest kompletna

## Podejście do implementacji

Trzy fazy w kolejności zależności: najpierw API (nie blokuje nic innego), potem React island + strona, na końcu nav bar (zmiana Layout.astro dotyka każdej strony — oddzielna faza dla bezpieczeństwa).

## Faza 1: API endpoints

### Przegląd

Dodanie `GET` do istniejącego `index.ts` oraz nowego pliku `[id].ts` z `PATCH` i `DELETE`.

### Wymagane zmiany:

#### 1. GET /api/flashcards — lista fiszek

**Plik**: `src/pages/api/flashcards/index.ts`

**Cel**: Dodać handler `GET` zwracający wszystkie fiszki zalogowanego użytkownika, posortowane `created_at DESC`.

**Kontrakt**:
- Export: `export const GET: APIRoute`
- Auth: `context.locals.user` — jeśli brak, 401 `{ error: "Unauthorized" }`
- Query: `.from("flashcards").select("id, front, back, created_at, updated_at").order("created_at", { ascending: false })`
- RLS automatycznie filtruje po `user_id` — nie trzeba `WHERE`
- Sukces: 200 `{ flashcards: Flashcard[] }`
- Błąd DB: 500 `{ error: "Nie udało się pobrać fiszek." }`

#### 2. PATCH + DELETE /api/flashcards/[id]

**Plik**: `src/pages/api/flashcards/[id].ts` (nowy)

**Cel**: Edycja i usuwanie pojedynczej fiszki identyfikowanej przez `id` z URL. RLS gwarantuje że użytkownik może modyfikować tylko swoje fiszki.

**Kontrakt PATCH**:
- Export: `export const PATCH: APIRoute`
- Params: `context.params.id`
- Body: `{ front: string, back: string }`
- Walidacja: `front.trim().length > 0 && front.length <= 500`, `back.trim().length > 0 && back.length <= 2000`; błędy → 400
- Query: `.from("flashcards").update({ front: front.trim(), back: back.trim() }).eq("id", id).select("id, front, back, created_at, updated_at").single()`
- Sukces: 200 `{ flashcard: Flashcard }`
- Not found (RLS zablokował lub zły id): 404 `{ error: "Fiszka nie istnieje." }`

**Kontrakt DELETE**:
- Export: `export const DELETE: APIRoute`
- Params: `context.params.id`
- Query: `.from("flashcards").delete().eq("id", id)`
- Sukces: 204 (brak body)
- Not found: 404 `{ error: "Fiszka nie istnieje." }`

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Type checking i linting: `npm run lint`
- Build produkcyjny: `npm run build`

#### Weryfikacja ręczna:

- GET `/api/flashcards` (zalogowany) → 200 z tablicą `flashcards`
- GET `/api/flashcards` (niezalogowany) → 401
- PATCH `/api/flashcards/<id>` z `{ front: "nowy", back: "tekst" }` → 200 ze zaktualizowaną fiszką
- PATCH z pustym `front` → 400
- PATCH z `front` > 500 znaków → 400
- DELETE `/api/flashcards/<id>` → 204
- DELETE cudzej fiszki (inny user_id) → 404 (RLS blokuje)

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich automatycznych weryfikacji, zatrzymaj się na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: FlashcardList island + strona /flashcards

### Przegląd

Nowa strona `/flashcards.astro` + React island `FlashcardList.tsx` z pełną logiką: fetch, sortowanie, inline edit, optimistic delete z Undo.

### Wymagane zmiany:

#### 1. Strona /flashcards

**Plik**: `src/pages/flashcards.astro` (nowy)

**Cel**: Chroniona strona-powłoka montująca island z listą fiszek.

**Kontrakt**: Frontmatter importuje `Layout` i `FlashcardList`. Template: `<Layout title="Moje fiszki"><FlashcardList client:load /></Layout>`. Brak danych server-side — island obsługuje fetch.

#### 2. FlashcardList React island

**Plik**: `src/components/flashcards/FlashcardList.tsx` (nowy)

**Cel**: Kompletny interfejs zarządzania fiszkami — lista, sortowanie, inline edit, delete z Undo.

**Kontrakt**:

Stan komponentu:
- `flashcards: Flashcard[]` — lista załadowana z API
- `loading: boolean` — stan ładowania przy fetch
- `error: string | null` — błąd globalny (fetch failure)
- `sortBy: "newest" | "oldest" | "az"` — aktualny sort (default: `"newest"`)
- `editingId: string | null` — id karty w trybie edycji
- `editFront: string`, `editBack: string` — wartości edytowanego formularza
- `pendingDelete: { id: string; card: Flashcard; timer: ReturnType<typeof setTimeout> } | null` — karta oczekująca na DELETE
- `toast: string | null` — komunikat toastu

Zachowanie:
- `useEffect` na mount: `fetch GET /api/flashcards` → ustaw `flashcards`
- Sortowanie: obliczone z `flashcards` + `sortBy` (client-side, bez re-fetchu); `"newest"` = `created_at DESC`, `"oldest"` = `created_at ASC`, `"az"` = `front ASC`
- Inline edit: klik w kartę (nie w przycisk delete) → `editingId = card.id`, `editFront/Back = card.front/back`; textarea z licznikiem znaków (500/2000); Zapisz → `PATCH`, optymistyczna aktualizacja w `flashcards`, błąd → przywróć + toast; Anuluj → `editingId = null`
- Delete z Undo: klik X → usuń kartę z `flashcards` natychmiast, zapisz w `pendingDelete` (karta + timer 5000ms), toast "Usunięto · **Cofnij**"; klik Cofnij → `clearTimeout`, przywróć kartę do listy, `pendingDelete = null`, toast znika; po 5s timer → `fetch DELETE /api/flashcards/[id]`, błąd → przywróć kartę + toast błędu
- Empty state (gdy `flashcards.length === 0` i `!loading`): komunikat + linki do `/generate` i `/dashboard`
- Toast: `position: fixed, bottom`, auto-hide po 4s (z wyjątkiem Undo-toast który żyje przez 5s)

Walidacja inline przed PATCH:
- `editFront.trim().length === 0` → zablokuj Zapisz + komunikat pod polem
- `editFront.length > 500` → zablokuj Zapisz + licznik zmienia kolor (jak w ManualCardForm)
- Analogicznie dla `editBack` z limitem 2000

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Type checking i linting: `npm run lint`
- Build produkcyjny: `npm run build`

#### Weryfikacja ręczna:

- `/flashcards` renderuje listę fiszek zalogowanego użytkownika
- Zmiana sortowania filtruje listę po stronie klienta bez re-fetchu
- Klik w kartę → textareas z aktualną zawartością
- Edycja + Zapisz → karta aktualizuje się w miejscu (bez re-fetchu całej listy)
- Edycja z pustym `front` → przycisk Zapisz zablokowany
- Klik X → karta znika, pojawia się toast z Cofnij przez 5s
- Klik Cofnij → karta wraca, toast znika, DELETE NIE został wysłany
- Po 5s bez Cofnij → karta usunięta (zweryfikować przez odświeżenie strony)
- Brak fiszek → empty state z linkami

**Uwaga implementacyjna**: Zatrzymaj się na ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: Globalny nav bar

### Przegląd

Dodanie shared nav baru do `Layout.astro` widocznego gdy użytkownik jest zalogowany. Usunięcie duplikatu (user info + logout) z `dashboard.astro`.

### Wymagane zmiany:

#### 1. Nav bar w Layout.astro

**Plik**: `src/layouts/Layout.astro`

**Cel**: Dodać responsywny nav bar wyświetlany gdy `Astro.locals.user` istnieje. Nav zawiera linki nawigacyjne i przycisk wylogowania.

**Kontrakt**:
- W frontmatter: `const user = Astro.locals.user;`
- Warunkowo renderuj `<nav>` jeśli `user` jest truthy
- Linki: Dashboard (`/dashboard`), Generuj (`/generate`), Moje fiszki (`/flashcards`)
- Wylogowanie: `<form method="POST" action="/api/auth/signout"><button>Wyloguj</button></form>`
- Email: opcjonalnie wyświetl `user.email` w nav (prawy koniec)
- Styl: spójny z istniejącą paletą (`bg-white/10 backdrop-blur-xl border-white/10 text-white`)

#### 2. Cleanup dashboard.astro

**Plik**: `src/pages/dashboard.astro`

**Cel**: Usunąć blok z emailem użytkownika i przyciskiem wylogowania (linie 21–36), który zostaje przeniesiony do nav baru.

**Kontrakt**: Usuń `<div class="rounded-2xl border border-white/10 ...">` zawierający email i formularz wylogowania. Zachowaj: success banner, `<ManualCardForm client:load />`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Type checking i linting: `npm run lint`
- Build produkcyjny: `npm run build`

#### Weryfikacja ręczna:

- Nav bar widoczny na `/dashboard`, `/generate`, `/flashcards`
- Nav bar NIEWIDOCZNY na `/auth/signin`, `/auth/signup`
- Aktywny link wizualnie wyróżniony (opcjonalne dla MVP)
- Wylogowanie z nav baru działa poprawnie
- Dashboard nie pokazuje duplikatu emaila/logout

---

## Strategia testowania

### Testy ręczne end-to-end:

1. Zaloguj się → wejdź na `/flashcards` — lista załadowana
2. Zmień sort na A-Z — lista przetasowuje się bez przeładowania
3. Kliknij fiszkę → edytuj front → Zapisz → weryfikuj aktualizację
4. Kliknij X przy fiszce → Cofnij w ciągu 5s → fiszka wraca
5. Kliknij X przy fiszce → odczekaj 5s → odśwież stronę → fiszka zniknęła
6. Wyloguj przez nav bar → przekierowanie na `/auth/signin`

### Przypadki brzegowe:

- API niedostępne podczas fetch → komunikat błędu + możliwość odświeżenia
- Edycja karty, następnie klik X innej karty — anuluje edycję pierwszej
- Ostatnia fiszka usunięta → empty state pojawia się natychmiast

## Referencje

- Powiązany roadmap: `context/foundation/roadmap.md` (S-02)
- Wzorzec inline edit: `src/components/flashcards/GenerateForm.tsx`
- Wzorzec API: `src/pages/api/flashcards/index.ts`
- Typy: `src/types.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dołącz ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: API endpoints

#### Automatyczne

- [x] 1.1 Type checking i linting: `npm run lint`
- [x] 1.2 Build produkcyjny: `npm run build`

#### Ręczne

- [ ] 1.3 GET `/api/flashcards` (zalogowany) → 200 z tablicą flashcards
- [ ] 1.4 GET `/api/flashcards` (niezalogowany) → 401
- [ ] 1.5 PATCH `/api/flashcards/<id>` z poprawnym body → 200 z zaktualizowaną fiszką
- [ ] 1.6 PATCH z pustym `front` → 400
- [ ] 1.7 PATCH z `front` > 500 znaków → 400
- [ ] 1.8 DELETE `/api/flashcards/<id>` → 204
- [ ] 1.9 DELETE cudzej fiszki → 404

### Faza 2: FlashcardList island + strona /flashcards

#### Automatyczne

- [x] 2.1 Type checking i linting: `npm run lint`
- [x] 2.2 Build produkcyjny: `npm run build`

#### Ręczne

- [ ] 2.3 `/flashcards` renderuje listę fiszek zalogowanego użytkownika
- [ ] 2.4 Zmiana sortowania filtruje listę client-side
- [ ] 2.5 Klik karta → textareas z aktualną zawartością
- [ ] 2.6 Edycja + Zapisz → karta aktualizuje się inline
- [ ] 2.7 Edycja z pustym `front` → przycisk Zapisz zablokowany
- [ ] 2.8 Klik X → karta znika + toast Cofnij przez 5s
- [ ] 2.9 Klik Cofnij → karta wraca, DELETE nie wysłany
- [ ] 2.10 Po 5s bez Cofnij → karta trwale usunięta
- [ ] 2.11 Brak fiszek → empty state z linkami

### Faza 3: Globalny nav bar

#### Automatyczne

- [x] 3.1 Type checking i linting: `npm run lint`
- [x] 3.2 Build produkcyjny: `npm run build`

#### Ręczne

- [ ] 3.3 Nav bar widoczny na `/dashboard`, `/generate`, `/flashcards`
- [ ] 3.4 Nav bar niewidoczny na `/auth/signin`
- [ ] 3.5 Wylogowanie z nav baru działa
- [ ] 3.6 Dashboard nie pokazuje duplikatu emaila/logout
