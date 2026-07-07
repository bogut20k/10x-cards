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

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Moduł 2, Lekcja 4

Przygotuj się na trudniejszy strumień implementacji z **łańcuchem planowania opartym na badaniach**:

```
badania wewnętrzne (/10x-research) + badania zewnętrzne (exa.ai, Context7) -> /10x-plan -> /10x-implement -> sukces
```

Lekcja koncentruje się na rozróżnianiu badań wewnętrznych od zewnętrznych oraz wykorzystywaniu dowodów do wspierania decyzji planistycznych.

### Router zadań - Od czego zacząć

| Umiejętność                                                      | Kiedy jej używać                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Badania wewnętrzne (fokus lekcji)**                            |                                                                                                                                                                                                                                                                  |
| `/10x-research <change-id>`                                      | Potrzebujesz dowodów z istniejącej bazy kodu — wzorców, konwencji, punktów integracji lub istniejących implementacji. Uruchamia równoległe sub-agenty w repozytorium i zapisuje ustrukturyzowane wyniki do `research.md`.                                        |
| **Badania zewnętrzne (fokus lekcji)**                            |                                                                                                                                                                                                                                                                  |
| exa.ai                                                           | Potrzebujesz natywnego dla AI wyszukiwania w sieci w celu porównania bibliotek, najlepszych praktyk lub kontekstu ekosystemu, na które baza kodu nie może odpowiedzieć.                                                                                          |
| Context7 (`resolve-library-id` → `get-library-docs`)             | Potrzebujesz aktualnej dokumentacji dla konkretnej biblioteki lub frameworka. Najpierw rozwiązuje ID biblioteki, a następnie pobiera odpowiednie strony dokumentacji.                                                                                            |
| **Kadrowanie koła zapasowego**                                   |                                                                                                                                                                                                                                                                  |
| `/10x-frame <change-id>`                                         | Plan nie zbiega się, plan nie przynosi oczekiwanych rezultatów, lub uporczywe odchylenia ciągle psują implementację. Użyj jako wyjścia awaryjnego dla oddzielnego problemu (zademonstrowane na przykładzie Space Explorers), a nie jako rytuału przed badaniami. |
| **Planowanie i wykonanie**                                       |                                                                                                                                                                                                                                                                  |
| `/10x-plan <change-id>` / `/10x-implement <change-id> phase <n>` | Użyj tego samego łańcucha planowania i wykonania z Lekcji 2, teraz z dowodami z badań wstępnych zasilającymi plan.                                                                                                                                               |

### Dyscyplina badawcza

- Badania wewnętrzne (`/10x-research`) odpowiadają na pytanie "co już robi nasza baza kodu?" — wzorce, schematy, konwencje, punkty integracji.
- Badania zewnętrzne (exa.ai, Context7) odpowiadają na pytanie "co powinniśmy zrobić?" — możliwości bibliotek, dokumentacja API, najlepsze praktyki ek

<!-- END @przeprogramowani/10x-cli -->
