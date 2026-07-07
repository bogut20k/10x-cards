---
project: "10xCards"
version: 1
status: draft
created: 2026-06-18
updated: 2026-06-18
prd_version: 1
main_goal: speed
top_blocker: external
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Student uczący się regularnie ma duże partie tekstu do przyswojenia i wie, że spaced repetition działa — ale ręczne tworzenie fiszek w Anki zajmuje tyle czasu, że rezygnuje z metody zanim zacznie przynosić efekty. 10xCards zamknie cały przepływ: wklej tekst → AI generuje fiszki → przejrzyj i zaakceptuj → zacznij powtarzać — bez opuszczania aplikacji.

## North star

**S-01 + S-04: Pierwsza pełna pętla generowania i powtórek** — jeśli użytkownik może w jednej sesji wkleić tekst, dostać fiszki od AI, zaakceptować je i natychmiast zacząć sesję powtórek, rdzeń hipotezy produktu jest zweryfikowany.

> *Gwiazda przewodnia* (north star) oznacza tutaj: najmniejszy przepływ end-to-end, którego shipping udowadnia, że produkt robi to, do czego jest zbudowany. Umieszczona tak wcześnie jak pozwalają zależności — wszystkie inne slajsy mają sens tylko pod warunkiem, że ta pętla działa.

## At a glance

| ID   | Change ID                | Outcome (user can …)                                         | Prerequisites | PRD refs                        | Status   |
| ---- | ------------------------ | ------------------------------------------------------------ | ------------- | ------------------------------- | -------- |
| F-00 | gate-product-routes      | (foundation) ochrona tras produktowych w middleware          | —             | NFR (bezpieczeństwo)            | done     |
| F-01 | flashcard-schema-and-rls | (foundation) schemat fiszek i stanu SR w DB + RLS            | —             | NFR (prywatność), FR-002, FR-005 | done     |
| S-01 | ai-generation-and-review | wkleić tekst, dostać fiszki od AI i zaakceptować/edytować je | F-01          | FR-001, FR-002, FR-003, US-01   | done        |
| S-02 | flashcard-edit-and-delete| edytować i usuwać zapisane fiszki                            | F-01, S-01    | FR-006                          | done     |
| S-03 | manual-card-creation     | ręcznie utworzyć fiszkę (przód + tył)                        | F-01          | FR-004                          | proposed |
| S-04 | spaced-repetition-session| przeprowadzić sesję powtórek opartą na algorytmie SR         | F-01, S-01    | FR-005, US-01                   | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                     | Note                                                                              |
| ------ | ----------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| A      | Core pętla              | `F-01` → `S-01` → `S-04` | Gwiazda przewodnia; shipping tej sekwencji = zweryfikowana hipoteza produktu.     |
| B      | Tworzenie i zarządzanie | `S-02` / `S-03`           | Oba wymagają F-01 (Stream A); S-02 dodatkowo S-01 — dołącza do Streamu A po S-01. |

## Baseline

What's already in place in the codebase as of 2026-06-18 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + Tailwind; strony auth wired (`src/pages/auth/signin.astro`, `src/pages/dashboard.astro`)
- **Backend / API:** partial — endpointy auth tylko (`src/pages/api/auth/`); brak domain endpointów dla fiszek
- **Data:** partial — Supabase client wired (`src/lib/supabase.ts`); zero migracji domenowych (`schema_paths = []` w `supabase/config.toml`)
- **Auth:** present — Supabase auth end-to-end: middleware (`src/middleware.ts`), trasy signin/signup/signout, ochrona `/dashboard`
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`), GitHub Actions CI/CD (`deploy.yml`, `ci.yml`)
- **Observability:** partial — Cloudflare native observability włączony (`wrangler.jsonc:12-14`); brak app-level logging / error tracking

## Foundations

### F-00: Ochrona tras produktowych w middleware

- **Outcome:** (foundation) middleware chroni `/flashcards`, `/generate`, `/review` i wszystkie `/api/*` (poza `/api/auth/*`) przed nieautoryzowanym dostępem — każdy przyszły slice dostaje ochronę trasy automatycznie bez per-route auth logiki.
- **Change ID:** gate-product-routes
- **PRD refs:** NFR (bezpieczeństwo)
- **Unlocks:** S-01, S-02, S-03, S-04 (wszystkie slajsy mogą budować endpointy bez własnej auth logiki)
- **Prerequisites:** —
- **Status:** done ✓

### F-01: Schemat danych fiszek i algorytmu powtórek

- **Outcome:** (foundation) tabele `flashcards` i stan spaced repetition per fiszka gotowe w Supabase z RLS ograniczającym dostęp wyłącznie do właściciela konta.
- **Change ID:** flashcard-schema-and-rls
- **PRD refs:** NFR (prywatność), FR-002, FR-005
- **Unlocks:** S-01 (potrzebuje tabeli `flashcards` do zapisu wygenerowanych fiszek), S-02 (potrzebuje stanu SR per fiszka), S-03 (potrzebuje tabeli `flashcards` do zapisu ręcznego), S-04 (potrzebuje tabeli `flashcards` do edycji i usuwania)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez RLS od startu każdy nowy endpoint może ujawnić fiszki innego użytkownika; znacznie taniej zrobić to teraz niż naprawiać po S-01.
- **Status:** done ✓

## Slices

### S-01: Generowanie fiszek przez AI i ich przegląd

- **Outcome:** użytkownik może wkleić tekst, zlecić AI wygenerowanie fiszek, przejrzeć je (zaakceptować zbiorczo lub edytować/usunąć pojedyncze) i zapisać do swojej kolekcji.
- **Change ID:** ai-generation-and-review
- **PRD refs:** FR-001, FR-002, FR-003, US-01
- **Prerequisites:** F-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - Który dostawca AI API zostanie użyty (OpenRouter, OpenAI, Anthropic itp.) i czy klucz API jest dostępny? — Owner: user. Block: yes.
- **Risk:** Jedyna zewnętrzna zależność w MVP; prompt engineering może wymagać kilku iteracji zanim jakość fiszek będzie wystarczająca. Wczesne uruchomienie = czas na iteracje przed resztą slajsów.
- **Status:** done ✓

### S-02: Edycja i usuwanie zapisanych fiszek

- **Outcome:** użytkownik może edytować przód lub tył zapisanej fiszki oraz usunąć ją z kolekcji.
- **Change ID:** flashcard-edit-and-delete
- **PRD refs:** FR-006
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Usunięcie fiszki powinno usunąć też jej stan SR (orphan records); wymagana kaskada w migracji lub soft delete — szczegół do rozstrzygnięcia w `/10x-plan flashcard-edit-and-delete`.
- **Status:** done ✓

### S-03: Ręczne tworzenie fiszek

- **Outcome:** użytkownik może ręcznie utworzyć fiszkę (przód + tył) bez użycia AI i zobaczyć ją natychmiast w swojej kolekcji.
- **Change ID:** manual-card-creation
- **PRD refs:** FR-004
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Prosta funkcja CRUD; niskie ryzyko. Może być budowana równolegle z S-01 w osobnym agent run po ukończeniu F-01.
- **Status:** proposed

### S-04: Sesja powtórek (spaced repetition)

- **Outcome:** użytkownik może przeprowadzić sesję powtórek swoich fiszek, gdzie algorytm spaced repetition (metoda optymalizująca harmonogram powtórek — decyduje kiedy pokazać każdą fiszkę, minimalizując liczbę sesji potrzebnych do zapamiętania) wyznacza kolejność, a użytkownik ocenia każdą fiszkę (łatwa / trudna / nie pamiętam).
- **Change ID:** spaced-repetition-session
- **PRD refs:** FR-005, US-01
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:**
  - Która gotowa biblioteka SR zostanie użyta (np. `ts-fsrs` dla FSRS, implementacja SM-2)? — Owner: user. Block: no.
- **Risk:** Sesja powtórek musi działać gdy AI API jest niedostępne (NFR); implementacja nie może być sprzężona z logiką S-01 — osobny endpoint, osobny flow.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                | Ready for `/10x-plan` | Notes                                                        |
| ---------- | ------------------------- | ---------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| F-01       | flashcard-schema-and-rls  | Schemat danych fiszek i RLS w Supabase               | yes                   | Run `/10x-plan flashcard-schema-and-rls`                     |
| S-01       | ai-generation-and-review  | Generowanie fiszek przez AI + przegląd przed zapisem | no                    | Zablokowane: wybór dostawcy AI API (Q-01)                    |
| S-02       | flashcard-edit-and-delete | Edycja i usuwanie zapisanych fiszek                  | no                    | Wymaga ukończenia F-01 + S-01                                |
| S-03       | manual-card-creation      | Ręczne tworzenie fiszki (przód + tył)                | no                    | Wymaga ukończenia F-01; może być planowane równolegle z S-01 |
| S-04       | spaced-repetition-session | Sesja powtórek (algorytm spaced repetition)          | no                    | Wymaga ukończenia S-01                                       |

## Open Roadmap Questions

1. **Który dostawca AI API zostanie użyty do generowania fiszek?** — Owner: user. Block: S-01 (shipping wymaga API key i wybranego dostawcy; planowanie `/10x-plan ai-generation-and-review` może ruszyć, ale shipping czeka na decyzję).

## Parked

- **Własny algorytm spaced repetition** — Why parked: PRD §Non-Goals — gotowe rozwiązanie (np. FSRS / SM-2) wystarczy na MVP; własna implementacja to osobny, wielomiesięczny projekt.
- **Import plików (PDF, DOCX)** — Why parked: PRD §Non-Goals — MVP obsługuje tylko copy-paste; import formatów binarnych to oddzielna feature z własnymi zależnościami.
- **Współdzielenie zestawów fiszek** — Why parked: PRD §Non-Goals — fiszki są prywatne per-account; funkcje społecznościowe to zakres v2.
- **Aplikacja mobilna (iOS / Android)** — Why parked: PRD §Non-Goals — MVP działa wyłącznie w przeglądarce desktop.
- **Integracje z platformami edukacyjnymi** — Why parked: PRD §Non-Goals — brak konektorów do Moodle, Canvas, LMS i innych platform.

## Done

(Empty on first generation. `/10x-archive` appends an entry here when a matching change is archived.)
