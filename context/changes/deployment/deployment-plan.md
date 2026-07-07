# Cloudflare Workers Deployment Plan — 10xCards

## Context

The 10xCards project (Astro 6 SSR + React 19 + TypeScript + Supabase) is scaffolded and CI is wired. `context/foundation/infrastructure.md` made the platform decision — Cloudflare Workers, 5/5 agent-friendly criteria, free at MVP request volume.

**Key discovery during deploy:** `@astrojs/cloudflare` v13 defaults to **Workers mode** (not Pages). The adapter uses `main: "@astrojs/cloudflare/entrypoints/server"` + `assets` binding in `wrangler.jsonc` and deploys via `wrangler deploy` — not `wrangler pages deploy`. Using the Pages command deploys only static assets without the SSR worker, causing "Nothing is here yet".

**Outcome:** push to `master` → GitHub Actions builds and deploys to `https://10x-cards.bogut20k.workers.dev` automatically, with Supabase auth working.

---

## Phase 0 — Prerequisites ✅

### 0a. Wrangler CLI

Wrangler is already a devDependency (`wrangler@4.90.0`) — no global install needed. Use `npx wrangler` throughout.

```bash
npx wrangler login    # opens browser OAuth
npx wrangler whoami   # verify — copy the Account ID
```

### 0b. Supabase — Create Project and Get Credentials ✅

1. https://supabase.com/dashboard → "New project" → name: `10x-cards`, region: West Europe (London)
2. Settings → API → copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_KEY`

### 0c. Supabase CLI — Authenticate and Link ✅

```bash
npx supabase login
npx supabase link --project-ref uebytioeeilxnsurhrwg
```

Project ref: `uebytioeeilxnsurhrwg`

### 0d. Local Dev — Wire `.dev.vars` ✅

```bash
cp .env.example .dev.vars
# fill SUPABASE_URL and SUPABASE_KEY
npm run dev
```

---

## Phase 1 — Automated File Changes ✅

### 1a. Fix `wrangler.jsonc` ✅

- `"name"`: `"10x-astro-starter"` → `"10x-cards"`
- Added `"disable_nodejs_process_v2"` to `compatibility_flags`

**Why `disable_nodejs_process_v2` is non-negotiable:** `nodejs_compat` on newer workerd activates "process v2," making Astro's internal `isNode` check return `true` and silently breaking SSR with opaque 500 errors.

### 1b. Create `.github/workflows/deploy.yml` ✅

Triggers on push to `master`. Uses `wrangler deploy` (Workers, not Pages).

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npx astro sync

      - run: npm run build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

---

## Phase 2 — Manual Gates ✅

### 2a. Create Cloudflare API Token ✅

https://dash.cloudflare.com/profile/api-tokens → **"Edit Cloudflare Workers"** template (not Pages template — Workers template includes KV and other resources wrangler v4 checks during pre-flight).

### 2b. Add GitHub Repository Secrets ✅

| Secret Name             | Value                             |
| ----------------------- | --------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token from Step 2a                |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from `wrangler whoami` |
| `SUPABASE_URL`          | Supabase project URL              |
| `SUPABASE_KEY`          | Supabase anon key                 |

### 2c. Set Cloudflare Workers Runtime Secrets ✅

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

Note: `wrangler pages secret put` is for Pages projects — Workers secrets use `wrangler secret put` (no `pages` subcommand).

### 2d. Create Pages Project ✅

The Workers project is created automatically on first `wrangler deploy`. However if using `wrangler pages deploy` (wrong command), the Pages project must be created first:

```bash
npx wrangler pages project create 10x-cards
```

This step is not needed for Workers — `wrangler deploy` creates the worker automatically.

---

## Phase 3 — First Deploy ✅

```bash
git push origin master   # triggers Deploy workflow
```

**CLI fallback:**

```bash
npm run build
npx wrangler deploy
```

---

## Phase 4 — Verification ✅

Auth flow tested and working:

1. Sign up → confirmation email sent to real email address ✅
2. Confirm email → link points to `https://10x-cards.bogut20k.workers.dev` ✅
3. Sign in / sign out ✅

Deployed URL: `https://10x-cards.bogut20k.workers.dev`

---

## Phase 4b — Supabase Site URL Configuration ✅

Supabase must have the production URL as `site_url` — otherwise confirmation emails link to `localhost`.

Set in Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://10x-cards.bogut20k.workers.dev`
- **Redirect URLs**: `https://10x-cards.bogut20k.workers.dev/**`

Local `supabase/config.toml` is kept in sync with these values. Push config changes with:

```bash
npx supabase config push --project-ref uebytioeeilxnsurhrwg
```

---

## Phase 5 — Post-Deploy Hardening (Before Real User Data)

Preview deployments are publicly accessible. Before seeding real user data, restrict access:

1. https://one.dash.cloudflare.com → Access → Applications → Add → Self-hosted
2. Domain: `*.10x-cards.bogut20k.workers.dev` (wildcard)
3. Policy: allow only your email
4. Leave bare `10x-cards.bogut20k.workers.dev` unprotected (production open)

---

## Sequencing Summary

```
[PREREQ] npx wrangler login → npx wrangler whoami (copy Account ID)
[PREREQ] Supabase project created → SUPABASE_URL + SUPABASE_KEY copied
[PREREQ] npx supabase login → npx supabase link --project-ref uebytioeeilxnsurhrwg
[PREREQ] cp .env.example .dev.vars → fill values → npm run dev
         ↓
[AUTO]   wrangler.jsonc: name="10x-cards", disable_nodejs_process_v2 ✅
[AUTO]   .github/workflows/deploy.yml: wrangler deploy (Workers mode) ✅
         ↓
[MANUAL] Cloudflare API token: "Edit Cloudflare Workers" template ✅
[MANUAL] GitHub secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
         SUPABASE_URL, SUPABASE_KEY ✅
[MANUAL] npx wrangler secret put SUPABASE_URL + SUPABASE_KEY ✅
[MANUAL] Supabase site_url → https://10x-cards.bogut20k.workers.dev ✅
         ↓
[DEPLOY] git push origin master → Deploy workflow → wrangler deploy ✅
         ↓
[VERIFY] auth flow: sign up → confirm email → sign in → sign out ✅
         ↓
[HARDEN] Cloudflare Access on *.workers.dev (before real user data)
```

---

## Risk Register Coverage

| Risk                                                               | How Addressed                                |
| ------------------------------------------------------------------ | -------------------------------------------- |
| `disable_nodejs_process_v2` missing → opaque 500s (H/H)            | Phase 1a: flag added to `wrangler.jsonc` ✅  |
| `wrangler pages deploy` used instead of `wrangler deploy` (H/H)    | Phase 1b: `command: deploy` in deploy.yml ✅ |
| `SUPABASE_*` undefined at runtime (H/H)                            | Phase 2c: `wrangler secret put` ✅           |
| Supabase `site_url` points to localhost → broken email links (H/H) | Phase 4b: site_url updated in Supabase ✅    |
| Preview URLs public by default (M/M)                               | Phase 5: Cloudflare Access (pending)         |

---

## Lessons Learned

- **`@astrojs/cloudflare` v12+ defaults to Workers mode**, not Pages. `wrangler pages deploy` only deploys static assets — the SSR worker is missing. Always use `wrangler deploy` with this adapter version.
- **Cloudflare API token must use "Edit Cloudflare Workers" template** — Pages-scoped tokens fail on wrangler v4 pre-flight KV namespace check even when the project doesn't use KV.
- **Workers secrets ≠ Pages secrets** — `wrangler secret put` for Workers, `wrangler pages secret put` for Pages. Wrong command silently succeeds but runtime env vars are missing.
- **Supabase `site_url` must be set before first registration** — default is `localhost`, confirmation emails link there.

---

## Critical Files

| File                           | Status                    |
| ------------------------------ | ------------------------- |
| `wrangler.jsonc`               | Updated ✅                |
| `.github/workflows/deploy.yml` | Created ✅                |
| `supabase/config.toml`         | Synced with production ✅ |
| `.github/workflows/ci.yml`     | No change needed          |
| `astro.config.mjs`             | No change needed          |
