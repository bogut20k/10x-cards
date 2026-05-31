---
bootstrapped_at: 2026-06-01T00:00:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: failed
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

| Signal      | Value                                                 | Severity    | Notes                                                        |
| ----------- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| npm package | not run                                               | n/a         | cmd_template uses `git clone`; no npm create CLI to resolve  |
| GitHub repo | not run                                               | unavailable | network unreachable from sandbox (Failed to connect to github.com port 443) |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 128
**Stderr (last 20 lines)**:

```
fatal: unable to access 'https://github.com/przeprogramowani/10x-astro-starter/': Failed to connect to github.com port 443 after 58 ms: Could not connect to server
```

**.bootstrap-scaffold left in place at**: `.bootstrap-scaffold/` — directory was not created (clone failed before creation)

## Post-scaffold audit

**Audit not run**: scaffold halted at Step 2; no project to audit.

## Hints recorded but not acted on

| Hint                    | Value                 |
| ----------------------- | --------------------- |
| bootstrapper_confidence | first-class           |
| quality_override        | false                 |
| path_taken              | standard              |
| self_check_answers      | null                  |
| team_size               | solo                  |
| deployment_target       | cloudflare-pages      |
| ci_provider             | github-actions        |
| ci_default_flow         | auto-deploy-on-merge  |
| has_auth                | true                  |
| has_payments            | false                 |
| has_realtime            | false                 |
| has_ai                  | true                  |
| has_background_jobs     | false                 |

## Next steps

This run failed at the scaffold step due to no outbound internet access from the current environment.

To retry once internet access is available:
- Run `/10x-bootstrapper` (copied to clipboard) from a shell or terminal that can reach github.com.
- Alternatively, clone the starter manually: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold` then re-invoke — bootstrapper will detect the existing `.bootstrap-scaffold/` directory and apply the conflict matrix from there.
