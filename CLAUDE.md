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

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server — Cloudflare workerd runtime |
| `npm run build` | Production build (SSR via `@astrojs/cloudflare`) |
| `npm run lint` | ESLint with type-checked rules |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Prettier (astro + tailwindcss plugins) |

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

## 10xDevs AI Toolkit - Moduł 2, Lekcja 3

Przejrzyj kod wygenerowany przez AI przed scaleniem za pomocą **łańcucha przeglądu implementacji**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` to główny temat lekcji. Przegląd jest bramką jakości, a nie instrukcją do naprawienia każdego znalezionego problemu.

### Router zadań - Od czego zacząć

| Umiejętność | Użyj, gdy |
| --- | --- |
| **Przegląd kodu (główny temat lekcji)** | |
| `/10x-impl-review <change-id>` | Zaimplementowałeś kod i chcesz przeprowadzić ustrukturyzowany przegląd przed scaleniem. Umiejętność sprawdza zgodność z planem, dyscyplinę zakresu, bezpieczeństwo i jakość, architekturę, spójność wzorców i kryteria sukcesu, a następnie przedstawia wyniki do triażu. |
| **Powtarzający się wynik lekcji** | |
| `/10x-lesson` | Znaleziony problem ujawnia powtarzającą się regułę projektu lub wzorzec błędu agenta. Zapisz go w `context/foundation/lessons.md` zamiast traktować jako jednorazową notatkę. |

### Dyscyplina triażu

- Ważność mówi, jak zły jest problem. Wpływ mówi, jak ważna jest decyzja teraz.
- Prawidłowe wyniki: napraw teraz, napraw inaczej, pomiń, zaakceptuj jako ryzyko, zapisz jako powtarzającą się regułę (`/10x-lesson`), nie zgadzam się.
- Napraw krytyczne problemy. Nie marnuj godzin na obserwacje o niskim wpływie tylko dlatego, że agent je znalazł.
- Świadome pomijanie problemów o niskim wpływie jest prawidłowym wynikiem przeglądu, a nie zaniedbaniem.
- Jeśli nie zgadzasz się z problemem, zapisz dlaczego. Błędne rozumowanie agenta również jest sygnałem.

### Granice przeglądu

- Ta lekcja dotyczy przeglądu zaimplementowanego kodu. Nie tworzy planu, nie wykonuje nowych faz ani nie uczy przeglądu CI.
- Strategia testowania i bramki jakości zostaną wprowadzone w Module 3.
- Nie używaj `/10x-contract` jako wyniku triażu w tej lekcji.

### Ścieżki używane w tej lekcji

- `context/changes/<change-id>/plan.md` - oczekiwana umowa implementacji
- `context/changes/<change-id>/reviews/` - wynik przeglądu
- `context/foundation/lessons.md` - powtarzające się lekcje

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
