---
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
---

## Why this stack

A solo developer shipping a 3-week after-hours MVP with auth and AI-powered flashcard generation needs a battle-tested, agent-friendly starter that covers auth, database, and edge deployment out of the box. 10x-astro-starter (Astro 6 + React 19 + TypeScript + Supabase + Cloudflare Pages) is the recommended default for (web-app, js) and clears all four agent-friendly quality gates: explicitly typed throughout (TypeScript + Zod at boundaries), strongly convention-based (Astro file routing, Supabase RLS, shadcn/ui components), well-represented in AI training data, and well-documented. Supabase covers auth (FR-001) and the PostgreSQL data layer for flashcards and spaced-repetition state; AI generation (FR-002) will be added via an Astro API route calling an external LLM SDK — a standard, edge-compatible pattern. Bootstrapper confidence is first-class. CI runs on GitHub Actions with auto-deploy on merge to main, matching the solo, shipping-first discipline the PRD calls for.
