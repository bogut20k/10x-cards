---
project: 10xCards
researched_at: 2026-06-09
recommended_platform: Cloudflare Workers + Pages
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6
  runtime: workerd (Cloudflare edge)
  database: Supabase (external PostgreSQL)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

The stack already targets Cloudflare Pages (`deployment_target: cloudflare-pages` in tech-stack.md) and the developer has hands-on Cloudflare familiarity (Q3). At 10k–100k monthly requests the platform is free (100K req/day free tier), making it the clear winner on cost (Q2: minimize cost). Global edge-native execution (Q4) is a first-class property, not an add-on. All five agent-friendly criteria score Pass. The `@astrojs/cloudflare` v13+ adapter ships production-parity workerd dev via `npm run dev`, so no separate platform tooling is needed for local development.

The two concrete risks to mitigate before first deploy: add `disable_nodejs_process_v2 = true` to `wrangler.toml` (prevents an undocumented Astro 6 SSR breakage) and set production secrets via `wrangler pages secret put` rather than relying on `.dev.vars`.

## Platform Comparison

### Scoring matrix

| Platform                       | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP/Integration | **Total**    |
| ------------------------------ | --------- | ------------------ | ---------- | ----------------- | --------------- | ------------ |
| **Cloudflare Workers + Pages** | Pass      | Pass               | Pass       | Pass              | Pass            | **5 Pass**   |
| Railway                        | Pass      | Pass               | Partial    | Pass              | Partial         | **3P / 2Pt** |
| Render                         | Partial   | Pass               | Pass       | Pass              | Partial         | **3P / 2Pt** |
| Fly.io                         | Pass      | Partial            | Partial    | Pass              | Partial         | **2P / 3Pt** |
| Vercel                         | Pass      | Pass               | Pass       | Pass              | Partial         | — (dropped)  |
| Netlify                        | Pass      | Pass               | Pass       | Pass              | Pass            | — (dropped)  |

**Hard filter applied (Q1 — persistent connections required):** Vercel and Netlify dropped — neither supports persistent WebSocket connections natively.

**Partial score notes:**

- Railway agent docs: SKILL.md + agent skills present, but no confirmed `llms.txt` / `llms-full.txt`
- Railway MCP: Beta / work-in-progress as of 2026-06-09
- Render CLI-first: CLI + deploy hooks exist but more limited than wrangler/railway for agent-driven ops
- Render MCP: GA (Aug 2025) but read-only — cannot trigger deploys or modify services
- Fly.io managed: Requires Dockerfile; not as abstracted as serverless
- Fly.io agent docs: MDX on GitHub, `llms.txt` at rendered site level (not static repo file)
- Fly.io MCP: `fly mcp server` — Experimental as of 2026-06-09

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Free at this request volume, edge-native global distribution, 5/5 agent-friendly criteria, GA MCP servers across API/Workers/Observability/Code Mode, and the stack already targets this platform. The `@astrojs/cloudflare` adapter v13+ provides workerd parity in dev, so `npm run dev` and production behave identically. Supabase connects externally; Hyperdrive can be added for connection pooling later. The strongest single signal: the developer is already familiar with the platform — the learning curve cost is $0.

#### 2. Railway

Full persistent containers with native WebSocket support, $5/month Hobby plan, zero-config Railpack auto-detection for Node.js, and a functional (beta) MCP server. The main gaps vs. Cloudflare: no free tier, single-region default on Hobby, and `llms.txt` is not published. Best fallback if the `workerd` runtime causes package-compatibility issues with an npm dependency that requires Node.js APIs unavailable in the edge runtime.

#### 3. Render

GA WebSocket support on paid plans ($7/month Starter), excellent agent docs (`llms.txt` + `llms-full.txt` + Render Skills repo), and a stable deploy API via hooks. Drops behind Railway because the Render MCP is read-only (cannot trigger deploys), the CLI is less capable, and the free tier's 15-minute sleep-on-inactivity makes it unsuitable for any persistent-connection use case. Viable if both Cloudflare and Railway become blockers.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **AI endpoint CPU may exceed the 10 ms free-tier limit.** FR-002 calls an external LLM and processes the response (JSON extraction, Zod validation, deduplication). CPU for that processing loop easily reaches 18–25 ms on inputs above ~800 characters. The free tier's 10 ms CPU cap forces an upgrade to the paid plan ($5/month) earlier than budgeted.

2. **`disable_nodejs_process_v2` is undocumented in official adapter docs.** The `nodejs_compat` flag combined with newer workerd activates "process v2," which makes Astro's internal `isNode` check return `true` — breaking SSR response handling with opaque 500 errors. The fix is one line in `wrangler.toml` but is not in the `@astrojs/cloudflare` documentation as of 2026-06-09.

3. **Durable Objects add meaningful complexity for WebSockets.** Unlike Railway or Render, where WebSockets work on a persistent container with no extra wiring, Cloudflare requires a separate Durable Object class with its own lifecycle, storage model, and hibernation API. For a solo 3-week MVP, this is a non-trivial time investment. Note: the PRD has `has_realtime: false` — if the persistent connection requirement is future-scoped, DO complexity is avoidable for the current MVP.

4. **`wrangler pages deploy` and `wrangler deploy` are not interchangeable.** Cloudflare Pages uses `wrangler pages deploy`; Workers use `wrangler deploy`. Using the wrong command either errors or deploys to the wrong environment. Several Astro deployment guides reference the wrong command.

5. **Vendor lock-in via workerd.** Code targeting `cloudflare:*` imports does not run on Node.js without an adapter swap. Migration to a container-based platform later requires reviewing all edge-specific code paths.

### Pre-Mortem — How This Could Fail

The team deployed 10xCards on Cloudflare Pages. Six months later the deployment decision was a recurring friction source.

The first issue surfaced in week one: the AI flashcard generation endpoint returned intermittent 500 errors. CPU profiling revealed that processing LLM responses (JSON extraction, Zod schema validation, safety filtering) consumed 18–22 ms CPU — above the free-tier 10 ms limit on inputs longer than ~800 characters. Upgrading to the paid plan ($5/month) resolved it, but the cost had not been budgeted.

The spaced repetition state tracking worked via Supabase lookups initially, but the developer wanted to cache session state at the edge to reduce cold-path Supabase round-trips. They attempted to add a Durable Object. The DO lifecycle documentation, hibernation API billing model, and WebSocket routing wiring cost two full development days — days that were supposed to complete two user stories.

The final friction came from a markdown-rendering library used for flashcard previews that relied on dynamic `require()` at runtime. Workerd blocked it; the workaround via Vite's `optimizeDeps.include` did not resolve the runtime call. The library required replacement with a pure-JS alternative.

In retrospect, the edge runtime was over-engineered for an MVP that only needed request/response SSR and an external Supabase database.

### Unknown Unknowns

1. **CPU time ≠ wall clock time.** Cloudflare measures CPU time, not wall clock. An LLM API call taking 3 seconds wall clock but only 2 ms CPU stays within the free tier. Developers unfamiliar with the distinction may either panic prematurely or fail to detect when CPU-heavy operations (JSON parsing, crypto, compression) hit the cap.

2. **`.dev.vars` is local-only; production requires `wrangler pages secret put`.** Environment variables in `.dev.vars` are never deployed. `process.env.SUPABASE_KEY` is `undefined` in production without an explicit `wrangler pages secret put SUPABASE_KEY`. There is no error — variables are silently absent.

3. **PRD has `has_realtime: false` — the persistent-connections answer may be future-scoped.** If the MVP does not need WebSockets today, Durable Objects are not required and the associated complexity drops entirely. Confirm before wiring DO infrastructure.

4. **`wrangler pages deploy ./dist --project-name <name>` is the correct Pages deploy command.** Bare `wrangler deploy` targets Workers, not Pages. The Astro adapter docs have referenced both in different versions; use only the Pages variant.

5. **Cloudflare Pages preview URLs are public by default.** Every branch deploy generates a `<branch>.<project>.pages.dev` URL accessible without authentication. For a product whose data is per-account private (NFR: flashcard content is private), preview environments should be protected with Cloudflare Access (Zero Trust) before any real user data is seeded.

## Operational Story

- **Preview deploys**: Every commit to a non-production branch automatically generates a preview URL at `<branch-name>.<project>.pages.dev`. Preview URLs are public by default — protect with Cloudflare Access if sensitive data may be present. Fork PR previews require explicit approval in the Pages dashboard before triggering a build.

- **Secrets**: `SUPABASE_URL` and `SUPABASE_KEY` live in Cloudflare Pages project settings → Environment Variables, scoped per environment (Preview / Production). Set via CLI: `wrangler pages secret put SUPABASE_URL --project-name 10x-cards`. Secrets are write-only after set (not readable in dashboard). Rotation: overwrite via dashboard or CLI; old value purges immediately on next request.

- **Rollback**: `wrangler rollback [DEPLOYMENT_ID]` or "Rollback to this deploy" button in the Pages dashboard. Rollback is instantaneous — it reactivates a previous build artifact without a rebuild. Database migrations (Supabase) do not roll back; coordinate schema changes separately before rolling back the app.

- **Approval**: Deploying to production is fully scriptable (`wrangler pages deploy`). Creating or deleting a Pages project, binding Durable Objects, and rotating the primary Cloudflare API token require a human. Agents may deploy, tail logs, and manage secrets unattended.

- **Logs**: `wrangler tail --format json` streams live request logs; filter with `--status error` or `--search "keyword"`. High-traffic Workers enter sampling mode (warning shown in output). Historical logs: Pages dashboard → Functions tab → real-time logs (24h retention on free plan). Structured agent-accessible logs: Cloudflare Observability MCP server at `mcp.cloudflare.com/observability`.

## Risk Register

| Risk                                                                                | Source           | Likelihood | Impact | Mitigation                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ---------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI endpoint CPU exceeds 10 ms free-tier limit                                       | Devil's advocate | M          | L      | Upgrade to paid ($5/m) proactively; monitor with `wrangler tail --status error`                                                                                    |
| `disable_nodejs_process_v2` undocumented gotcha breaks Astro 6 SSR                  | Unknown unknowns | H          | H      | Add `compatibility_flags = ["disable_nodejs_process_v2"]` to `wrangler.toml` before first deploy                                                                   |
| `wrangler deploy` vs `wrangler pages deploy` causes deploy to wrong target          | Unknown unknowns | H          | M      | Use `wrangler pages deploy ./dist --project-name 10x-cards` exclusively — never bare `wrangler deploy`                                                             |
| `SUPABASE_URL` / `SUPABASE_KEY` undefined in production (`.dev.vars` not deployed)  | Unknown unknowns | H          | H      | Run `wrangler pages secret put SUPABASE_URL` and `wrangler pages secret put SUPABASE_KEY` before first production deploy; verify with `wrangler pages secret list` |
| Preview URLs are public by default, exposing per-account flashcard data             | Unknown unknowns | M          | M      | Enable Cloudflare Access on `*.10x-cards.pages.dev` before seeding any real user data                                                                              |
| npm package uses Node.js API unavailable in workerd, fails at runtime not buildtime | Pre-mortem       | L          | M      | Audit `package.json` for packages that use `fs`, `child_process`, or native C++ bindings; test with `npm run dev` (workerd parity) before adding new dependencies  |
| Vendor lock-in: migration to Node.js platform requires adapter swap                 | Devil's advocate | L          | L      | Keep `cloudflare:*` imports isolated to adapter boundary files; core business logic stays in framework-agnostic modules                                            |

## Getting Started

These steps assume the 10x-astro-starter is already scaffolded with `@astrojs/cloudflare` (confirmed in tech-stack.md). Steps are Astro 6 + wrangler-specific, not generic.

1. **Install and authenticate wrangler** (if not already):

   ```
   npm install -g wrangler
   wrangler login
   ```

2. **Add the process v2 compatibility flag** to `wrangler.toml` (or create it at project root if absent):

   ```toml
   name = "10x-cards"
   compatibility_date = "2024-09-23"
   compatibility_flags = ["nodejs_compat", "disable_nodejs_process_v2"]
   pages_build_output_dir = "./dist"
   ```

3. **Set production secrets** (do this before first deploy):

   ```
   wrangler pages secret put SUPABASE_URL --project-name 10x-cards
   wrangler pages secret put SUPABASE_KEY --project-name 10x-cards
   ```

4. **Build and deploy**:

   ```
   npm run build
   wrangler pages deploy ./dist --project-name 10x-cards
   ```

   On first run, wrangler will prompt to create the Pages project — accept with the default name `10x-cards`.

5. **Verify** — tail live logs while exercising the deployed URL:
   ```
   wrangler tail --project-name 10x-cards --format pretty
   ```
   Confirm auth flow (FR-001) and AI generation endpoint (FR-002) complete without errors. Check CPU time in log output — if any request exceeds 10 ms CPU, upgrade to the paid plan before inviting real users.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions auto-deploy is specified in tech-stack.md — configure separately)
- Production-scale architecture (multi-region, HA, DR)
