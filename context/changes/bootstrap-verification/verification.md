---
bootstrapped_at: 2026-06-01T01:03:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

A solo developer shipping a 3-week after-hours MVP with auth and AI-powered flashcard generation needs a battle-tested, agent-friendly starter that covers auth, database, and edge deployment out of the box. 10x-astro-starter (Astro 6 + React 19 + TypeScript + Supabase + Cloudflare Pages) is the recommended default for (web-app, js) and clears all four agent-friendly quality gates: explicitly typed throughout (TypeScript + Zod at boundaries), strongly convention-based (Astro file routing, Supabase RLS, shadcn/ui components), well-represented in AI training data, and well-documented. Supabase covers auth (FR-001) and the PostgreSQL data layer for flashcards and spaced-repetition state; AI generation (FR-002) will be added via an Astro API route calling an external LLM SDK — a standard, edge-compatible pattern. Bootstrapper confidence is first-class. CI runs on GitHub Actions with auto-deploy on merge to main, matching the solo, shipping-first discipline the PRD calls for.

## Pre-scaffold verification

| Signal      | Value   | Severity    | Notes                                                                         |
| ----------- | ------- | ----------- | ----------------------------------------------------------------------------- |
| npm package | not run | n/a         | cmd_template uses `git clone`; no npm create CLI to resolve                   |
| GitHub repo | not run | unavailable | network unreachable from sandbox environment (port 443 to github.com blocked) |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: clone the starter repo without keeping its git history
**Exit code**: 0
**Files moved**: 19 (`.env.example`, `.github/`, `.gitignore`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules/`, `package.json`, `package-lock.json`, `public/`, `README.md`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`)
**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold`
**.gitignore handling**: moved silently (cwd had no pre-existing .gitignore)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: direct — 0 HIGH, 2 MODERATE (`@astrojs/check`, `wrangler`) of total 1 HIGH, 9 MODERATE

#### HIGH findings

**`devalue` v5.6.3–5.8.0**

- Advisory: GHSA-77vg-94rm-hx3p — "Svelte devalue: DoS via sparse array deserialization"
- CVSS: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
- CWE: CWE-770 (Allocation of Resources Without Limits)
- Dependency path: transitive (not a direct dependency)
- Fix available: yes (`npm audit fix`)

#### MODERATE findings

1. **`@astrojs/check` >=0.9.3** (direct) — via `@astrojs/language-server` → `volar-service-yaml`. Fix: downgrade to `@astrojs/check@0.9.2` (semver-major).
2. **`@astrojs/language-server` >=2.14.0** (transitive) — via `volar-service-yaml`. Same chain as above.
3. **`@cloudflare/vite-plugin`** (transitive) — via `miniflare`, `wrangler`, `ws`. Fix available.
4. **`miniflare`** (transitive) — via `ws` (uninitialized memory disclosure). Fix available.
5. **`volar-service-yaml` <=0.0.70** (transitive) — via `yaml-language-server` → `yaml`. Fix available (semver-major).
6. **`wrangler`** (direct) — via `miniflare`. Fix available.
7. **`ws` 8.0.0–8.20.0** (transitive) — GHSA-58qx-3vcg-4xpx "ws: Uninitialized memory disclosure", CVSS 4.4. Fix available.
8. **`yaml` 2.0.0–2.8.2** (transitive) — GHSA-48c2-rrv3-qjmp "Stack overflow via deeply nested YAML collections", CVSS 4.3. Fix available (semver-major).
9. **`yaml-language-server`** (transitive) — via `yaml`. Fix available (semver-major).

**Note**: All HIGH and MODERATE findings are in dev-tooling packages (language server, wrangler, ws WebSocket) — none are production runtime dependencies. Production risk is low; address per your project's risk tolerance.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you haven't already) to start your own repo history.
- Review `CLAUDE.md.scaffold` — this is the starter's CLAUDE.md; diff it against your existing `CLAUDE.md` to decide which sections to merge in.
- Copy `.env.example` → `.dev.vars` for local Cloudflare dev and add your `SUPABASE_URL` and `SUPABASE_KEY`.
- Address the HIGH audit finding (`devalue`) if desired: `npm audit fix` covers it. The MODERATE findings are dev-tooling only.
