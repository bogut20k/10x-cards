# Research: ts-fsrs API — Context7 docs

Pobrane 2026-07-14 via `/context7-search`. Źródło: `/open-spaced-repetition/ts-fsrs` (High reputation, 466 snippets).

## Instalacja i init

```typescript
import { fsrs, Rating, createEmptyCard, TypeConvert, State } from 'ts-fsrs'

const scheduler = fsrs()       // domyślne parametry FSRS
const card = createEmptyCard() // nowa fiszka, state=New, due=now
```

## Core loop — ocenianie fiszki

```typescript
// Podgląd wszystkich 4 wyników przed odpowiedzią użytkownika
const preview = scheduler.repeat(card, new Date())
// preview[Rating.Again].card → następny termin dla każdej oceny

// Zastosowanie oceny po odpowiedzi
const result = scheduler.next(card, new Date(), Rating.Good)

const updatedCard = result.card  // zapisz do DB
const logEntry    = result.log   // opcjonalnie: historia powtórek
```

### Rating enum

```typescript
enum Rating {
  Manual = 0,  // wewnętrzny
  Again  = 1,  // Nie pamiętam
  Hard   = 2,  // Trudna, ale poprawna
  Good   = 3,  // Poprawna
  Easy   = 4,  // Bardzo łatwa
}
```

## Card interface — pola do zapisania w DB

```typescript
interface Card {
  due: Date              // kiedy pokazać następny raz
  stability: number      // siła pamięci (interwał przy R=90%)
  difficulty: number     // trudność (1–10)
  scheduled_days: number // dni do następnej powtórki
  learning_steps: number // pozycja w krokach nauki
  reps: number           // łączna liczba powtórek
  lapses: number         // ile razy zapomniana
  state: State           // New=0 | Learning=1 | Review=2 | Relearning=3
  last_review?: Date
}
```

### State enum

```typescript
enum State {
  New        = 0,  // nigdy nie przeglądana
  Learning   = 1,  // w początkowych krokach nauki
  Review     = 2,  // w długoterminowym harmonogramie
  Relearning = 3,  // po nieudanej powtórce
}
```

## Ładowanie karty z DB i normalizacja typów

Dane z Supabase przychodzą jako stringi — `TypeConvert.card()` przywraca właściwe typy:

```typescript
import { TypeConvert } from 'ts-fsrs'

const card = TypeConvert.card({
  due: raw.due,                        // string ISO → Date
  state: raw.state,                    // number → State enum
  stability: raw.stability,
  difficulty: raw.difficulty,
  elapsed_days: 0,
  scheduled_days: raw.scheduled_days,
  learning_steps: raw.learning_steps,
  reps: raw.reps,
  lapses: raw.lapses,
})

const result = scheduler.next(card, new Date(), Rating.Good)
```

## Filtrowanie kart należnych do sesji

```typescript
const now = new Date()
const dueCards = allCards.filter(c => new Date(c.due) <= now)
```

## Metody schedulera

| Metoda | Opis |
|---|---|
| `scheduler.repeat(card, now)` | Podgląd wszystkich 4 wyników (przed odpowiedzią) |
| `scheduler.next(card, now, grade)` | Zastosowanie oceny → zwraca `{ card, log }` |
| `scheduler.get_retrievability(card, now)` | Prawdopodobieństwo przypomnienia (0–1) |
| `scheduler.rollback(card, log)` | Cofnięcie ostatniej oceny |
| `scheduler.forget(card, now)` | Reset fiszki do stanu New |

## Konfiguracja parametrów FSRS (opcjonalne)

```typescript
import { fsrs, type FSRSParameters } from 'ts-fsrs'

const params = JSON.parse(serializedParams) as FSRSParameters
const scheduler = fsrs(params)
// params.request_retention  — domyślnie 0.9 (90% recall)
// params.maximum_interval   — domyślnie 36500 dni
```

## Uwagi implementacyjne dla S-04

- Biblioteka działa wyłącznie po stronie serwera/edge — obliczenia w `POST /api/review`.
- `scheduler.next()` to jedyna funkcja potrzebna do flow: pobierz fiszkę z DB → `next()` z oceną → zapisz `result.card` do DB.
- `repeat()` opcjonalnie: pokaż użytkownikowi przedział dla każdej oceny (UX jak Anki).
- Tabela SR z F-01 powinna pokrywać wszystkie pola `Card` — zweryfikować kolumny przed `/10x-plan`.
- `nodejs_compat` w `wrangler.jsonc` wymagany (Node.js ≥ 20 runtime).
