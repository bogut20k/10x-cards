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

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
