<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Spaced Repetition Review Session (S-04)

- **Plan**: `context/changes/srs-review-session/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-07-14
- **Werdykt**: SOLIDNY (po poprawkach)
- **Ustalenia**: 1 krytyczne · 2 ostrzeżenia · 1 obserwacja

## Werdykty

| Wymiar                       | Werdykt        |
| ---------------------------- | -------------- |
| Zgodność ze stanem końcowym  | ZALICZONY      |
| Oszczędne wykonanie          | ZALICZONY      |
| Dopasowanie architektoniczne | ZALICZONY      |
| Martwe punkty                | OSTRZEŻENIE    |
| Kompletność planu            | NIEZALICZONY   |

## Ugruntowanie

5/5 ścieżek ✓ · 4/4 symboli ✓ · brief↔plan ✓

## Ustalenia

### F1 — Sekcja Progress używa polskich nagłówków — /10x-implement nie sparsuje

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: plan.md linia 303 — dół planu
- **Szczegóły**: Skill `/10x-implement` skanuje plan w poszukiwaniu dosłownego nagłówka `## Progress` (nie `## Postęp`) i podsekcji `### Phase N:` (nie `### Faza N:`). Plan ma `## Postęp`, `### Faza 1: Foundation`, `### Faza 2: Backend API`, `### Faza 3: Frontend`. Efekt: `/10x-implement` nie znajdzie sekcji postępu ani faz. Zweryfikowane w `.claude/skills/10x-plan/references/progress-format.md` (linie 7, 15, 38) i `.claude/skills/10x-implement` (linie 22, 58, 271).
- **Poprawka**: Zmień 4 nagłówki w sekcji postępu (treść faz `## Faza N:` może zostać po polsku): `## Postęp` → `## Progress`, `### Faza 1: Foundation` → `### Phase 1: Foundation`, `### Faza 2: Backend API` → `### Phase 2: Backend API`, `### Faza 3: Frontend` → `### Phase 3: Frontend`.
- **Decyzja**: NAPRAWIONE (zmieniono `## Postęp` → `## Progress` i `### Faza N:` → `### Phase N:` w sekcji postępu)

### F2 — Wygaśnięcie sesji w trakcie przeglądu — fetch dostanie HTML, nie JSON

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, żeby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 — ReviewSession.tsx, obsługa POST
- **Szczegóły**: Middleware (`src/middleware.ts:27`) dla wszystkich `/api/*` tras robi `context.redirect("/auth/signin")` — 302, nie 401 — gdy brak użytkownika. Przeglądarka w `fetch()` domyślnie podąża za redirectem, więc React island po wygaśnięciu tokenu dostanie 200 HTML strony logowania, nie JSON. Wywołanie `response.json()` rzuci SyntaxError. Plan mówi "błąd sieci... pokaż toast lub prosty komunikat" ale nie adresuje tego konkretnego scenariusza.
- **Poprawka**: W obsłudze POST w ReviewSession.tsx dodaj sprawdzenie przed `.json()`: `if (!response.ok || response.redirected) { /* redirect do /auth/signin lub komunikat */ }`. Albo `fetch(url, { redirect: 'manual' })` → jeśli `response.type === 'opaqueredirect'` → obsłuż jak wygaśnięcie sesji.
  - Siła: Małe, lokalne sprawdzenie; nie wymaga zmian middleware.
  - Kompromis: `redirect: 'manual'` zmienia też zachowanie dla innych redirectów; `response.redirected` jest prostszy.
  - Pewność: WYSOKA — istniejący wzorzec `[id].ts` potwierdza zachowanie.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: NAPRAWIONE (dodano sprawdzenie `response.redirected` do kontraktu ReviewSession.tsx w Fazie 3)

### F3 — POST /api/review — brak jawnej logiki 404 gdy karta nie istnieje

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 — POST /api/review kontrakt
- **Szczegóły**: Kontrakt POST mówi "RLS zapewnia własność" i wymienia kody `404/400/500` ale nie precyzuje kiedy 404. Scenariusz: karta usunięta między GET session a POST oceny. SELECT po RLS zwróci 0 wierszy. Supabase nie rzuca błędu przy braku wierszy (zwraca pustą listę) — implementator musi samodzielnie wywnioskować logikę 404.
- **Poprawka**: Dodaj do kontraktu POST jeden punkt: "Jeśli SELECT zwróci pusty wynik → `{ error: 'Fiszka nie istnieje.' }` (404)".
- **Decyzja**: ZAAKCEPTOWANE

### F4 — Karty "Again" nie wracają do bieżącej sesji — ekran "Gotowe" może mylić

- **Waga**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 — ekran done, sekcja "Strategia testowania"
- **Szczegóły**: Sesja ładuje max 20 kart przy starcie i jest statyczna. Karty ocenione jako "Again" dostają due za ~10 min, ale nie wracają do kolejki tej sesji. Ekran "Gotowe na dziś!" pojawia się mimo że karty Again są już due. Plan wyklucza learning queue, ale nie wspomina o tym w opisie ekranu done.
- **Poprawka**: Dodaj notę implementacyjną do ekranu done: "Karty 'Again' nie wracają do bieżącej sesji — celowe, MVP nie implementuje learning queue. Czas powrotu oblicz z `next_due` z GET session."
- **Decyzja**: ODRZUCONE
