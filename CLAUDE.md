# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace layout

This is a 10xDevs AI Toolkit workspace. The main deliverable project lives in `10x-astro-starter/`, which has its own `CLAUDE.md` with full commands and architecture detail. The `context/` and `docs/` directories (created by `/10x-init`) hold shaping and PRD artefacts for any new project started here.

```
K:\@Claude-Code-Workspace\
├── 10x-astro-starter/   ← Astro 6 SSR starter (own CLAUDE.md inside)
├── context/             ← shape-notes, prd, lessons (written by 10x skills)
├── docs/                ← contract-surfaces registry (written by 10x skills)
└── compact_prompt.txt   ← Polish-language context-compaction prompt
```

## 10x-astro-starter — quick reference

Working directory: `10x-astro-starter/`. Node.js v22.14.0 (see `.nvmrc`).

| Command            | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Dev server — Cloudflare workerd runtime          |
| `npm run build`    | Production build (SSR via `@astrojs/cloudflare`) |
| `npm run lint`     | ESLint with type-checked rules                   |
| `npm run lint:fix` | Auto-fix lint issues                             |
| `npm run format`   | Prettier (astro + tailwindcss plugins)           |

Environment: copy `.env.example` → `.dev.vars` for Cloudflare local dev. `SUPABASE_URL` and `SUPABASE_KEY` are the only required secrets.

## 10x-astro-starter — architecture in brief

Astro 6 full-SSR (`output: "server"`) deployed on Cloudflare Workers. React 19 islands for interactive UI only; static content stays in `.astro` components.

**Auth** is Supabase-based with cookie sessions (`@supabase/ssr`). The middleware at `src/middleware.ts` resolves `context.locals.user` on every request and guards routes listed in `PROTECTED_ROUTES`. Auth API endpoints live in `src/pages/api/auth/`.

**Key conventions inside the sub-project:**

- Path alias `@/*` → `src/*`
- Conditional class merging: always use `cn()` from `@/lib/utils`, never manual string concatenation
- shadcn/ui components in `src/components/ui/` ("new-york" variant); add with `npx shadcn@latest add [name]`
- Shared types (entities, DTOs) in `src/types.ts`; business logic helpers in `src/lib/` or `src/lib/services/`
- Supabase migrations in `supabase/migrations/` — always enable RLS on new tables

## Testy E2E (Playwright MCP)

Dev server zawsze na porcie **4321** (ustawione w `astro.config.mjs`). Uruchamiaj przez `npx wrangler dev --port 4321`.

### Konta testowe

Dane w `.dev.vars` (gitignored). Projekt Supabase: `uebytioeeilxnsurhrwg`.

| Konto | Email | Hasło | Fiszki |
|-------|-------|-------|--------|
| konto-0-fiszek | test2@10xcards.test | Test1234! | 0 |
| konto-10-fiszek | test_10fiszek@10xcards.test | Test1234! | 10, due 2026-07-01 |
| konto-100-fiszek | test_100fiszek@10xcards.test | Test1234! | ~2 |

Skrypt do wstawiania fiszek testowych: `test-output/insert-cards.sh`.

### Logowanie przez Playwright

React controlled inputs nie reagują na `browser_fill_form`. Używaj JS form submit:

```js
const form = document.createElement('form');
form.method = 'POST'; form.action = '/api/auth/signin';
const e = document.createElement('input'); e.name = 'email'; e.value = 'EMAIL';
const p = document.createElement('input'); p.name = 'password'; p.value = 'PASS';
form.appendChild(e); form.appendChild(p);
document.body.appendChild(form); form.submit();
```

### Kliknięcia React przez Playwright

`browser_click` nie dociera do React onClick. Używaj `browser_evaluate` z `element.click()` lub `dispatchEvent(new MouseEvent('click', { bubbles: true }))`.

### Skróty klawiszowe strony /review

| Klawisz | Akcja |
|---------|-------|
| `Space` | Flip karty (przód → tył) |
| `1` | Again |
| `2` | Hard |
| `3` | Good |
| `4` | Easy |

## Supabase — znane pułapki

- `flashcards.user_id` ma `ON DELETE CASCADE` — usunięcie konta w Auth **usuwa wszystkie fiszki** użytkownika. Przy przepinaniu fiszek na inne konto: najpierw `UPDATE flashcards SET user_id = '<nowe>' WHERE user_id = '<stare>'`, dopiero potem usuń stare konto.
- RLS blokuje INSERT bez `user_id` — zawsze podawaj `user_id` przy ręcznym wstawianiu przez REST API (anon key nie omija RLS).
- Migracje przez `supabase db push` mogą być blokowane przez AVG — używaj MCP Supabase `apply_migration`.

## 10x Auth — automatyczne logowanie przez magic link

Projekt: `K:\@Claude-Code-Workspace\10x-auth-omegacode\` — pełna dokumentacja i skrypty tam.
Skill: `/10x-auth-omegacode`

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Moduł 2, Lekcja 5

Skaluj cykl pojedynczych zmian do pracy równoległej za pomocą **worktrees, delegowania ukierunkowanego na cel i orkiestracji wielu sesji**:

```
worktree per change -> /goal or claude -p -> PR -> review -> merge
```

Lekcja koncentruje się na bezpiecznej przepustowości: izolowanych kontekstach, wyborze odpowiedniego trybu wykonania i ograniczeniu równoległości do zdolności przeglądu.

### Router zadań - Od czego zacząć

| Umiejętność | Kiedy jej używać |
| --- | --- |
| **Izolacja kodu** | |
| `git worktree add` | Potrzebujesz oddzielnego katalogu roboczego dla równoległej zmiany. Jedna zmiana na worktree, jeden świeży kontekst agenta na worktree. |
| **Złożone zmiany** | |
| `/10x-implement <change-id> phase <n>` | Zmiana ma wiele faz, wymaga ręcznych bramek lub korzysta z interaktywnego podejmowania decyzji podczas wykonania. |
| **Proste zmiany** | |
| `/goal` | Masz jasne, ograniczone zadanie i chcesz delegowania ukierunkowanego na cel. Agent pracuje autonomicznie w kierunku określonego celu z warunkiem zatrzymania. |
| `claude -p` | Chcesz bezgłowego wykonania dla dobrze zdefiniowanego zadania. Pętla Ralpha Wigguma (uruchom, sprawdź, spróbuj ponownie) to uniwersalny autonomiczny wzorzec. |
| **Orkiestracja wielu sesji** | |
| Superset / Conductor / Antigravity / VS Code Agent View | Uruchamiasz wiele sesji agentów równolegle i potrzebujesz widoczności, koordynacji lub zarządzania sesjami między nimi. |

### Zasady pracy równoległej

- Jedna zmiana na worktree lub izolowany obszar roboczy. Jeden świeży kontekst agenta na zmianę.
- Wybierz interaktywne `/10x-implement` dla złożonych zmian, `/goal` lub `claude -p` dla prostych.
- Równoległość jest ograniczona przez zdolność przeglądu. Więcej agentów bez przeglądu oznacza więcej nieprzejrzanego kodu, a nie wyższą przepustowość.
- Ból jakości wynikający z szybszej wysyłki jest celowy — łączy się z bramkami testowymi Modułu 3.

### Granice lekcji

- Nie ucz ponownie interaktywnego `/10x-implement` ani `/10x-impl-review`; to są Lekcje 2 i 3.
- Nie wprowadzaj tutaj strategii testowania. Ból jakości jest motywacją dla Modułu 3.
- Worktrees to mechanizm izolacji, a nie temat pełnego samouczka git.

### Ścieżki używane w tej lekcji

- `context/changes/<change-id>/` - aktywny folder zmian
- `context/changes/<change-id>/plan.md` - dane wejściowe implementacji dla dowolnego trybu wykonania

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`."

<!-- END @przeprogramowani/10x-cli -->
