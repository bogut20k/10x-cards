# Cloudflare Pages Deployment Plan — 10xCards

## Context

The 10xCards project (Astro 6 SSR + React 19 + TypeScript + Supabase) is scaffolded and CI is wired, but has never been deployed. `context/foundation/infrastructure.md` already made the platform decision — Cloudflare Workers + Pages, 5/5 agent-friendly criteria, free at MVP request volume — and documented two high-probability/high-impact risks that must be mitigated before the first deploy. This plan executes the first deploy end-to-end, wires GitHub Actions auto-deploy, and closes all risk register items.

**Intended outcome:** push to `master` → GitHub Actions builds and deploys to `https://10x-cards.pages.dev` automatically, with Supabase auth working and no runtime 500 errors.

---

## Phase 1 — Automated File Changes

### 1a. Fix `wrangler.jsonc` ✅

**File:** `wrangler.jsonc`

Two changes:
- Renamed `"name"` from `"10x-astro-starter"` → `"10x-cards"` (matches `project_name` in `tech-stack.md`)
- Added `"disable_nodejs_process_v2"` to `compatibility_flags`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "10x-cards",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-05-08",
  "compatibility_flags": ["nodejs_compat", "disable_nodejs_process_v2"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "404-page",
  },
  "observability": {
    "enabled": true,
  },
}
```

**Why `disable_nodejs_process_v2` is non-negotiable:** `nodejs_compat` on newer workerd activates "process v2," making Astro's internal `isNode` check return `true` and silently breaking SSR with opaque 500 errors. Risk register: Likelihood H, Impact H. Not in official `@astrojs/cloudflare` docs.

---

### 1b. Create `.github/workflows/deploy.yml` ✅

**File:** `.github/workflows/deploy.yml` (created)

Separate from the existing `ci.yml` — CI runs on push + PR; deploy runs on push to `master` only.

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

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ./dist --project-name 10x-cards
```

**Design decisions:**
- `permissions: deployments: write` — least-privilege, no OIDC needed (API token auth)
- `npx astro sync` before build — generates `.astro/types.d.ts`, matches pattern in `ci.yml`
- `SUPABASE_URL`/`SUPABASE_KEY` as build-time env — satisfies Astro's `envField` validation at build; runtime values come from Cloudflare secrets (Step 2d)
- `pages deploy ./dist --project-name 10x-cards` — Pages-specific command; bare `wrangler deploy` targets Workers, not Pages (risk register row 3)

---

## Phase 2 — Manual Gates (Must Be Done In Order)

### 2a. Authenticate Wrangler Locally

```bash
wrangler login       # opens browser OAuth
wrangler whoami      # verify — copy the Account ID shown
```

### 2b. Create Cloudflare API Token

Go to: https://dash.cloudflare.com/profile/api-tokens → "Create Token" → use template **"Cloudflare Pages — Edit"**

Required permissions:
| Resource | Permission |
|---|---|
| Account > Cloudflare Pages | Edit |
| Account > Account Settings | Read |

Save the token — shown only once.

### 2c. Add GitHub Repository Secrets

Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token from Step 2b |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from `wrangler whoami` |
| `SUPABASE_URL` | Supabase project URL (may already exist from CI) |
| `SUPABASE_KEY` | Supabase anon key (may already exist from CI) |

### 2d. Set Cloudflare Production Runtime Secrets

These are the runtime env vars the workerd process reads at request time. `.dev.vars` is never deployed — these must be set explicitly (risk register row 4).

```bash
wrangler pages secret put SUPABASE_URL --project-name 10x-cards
wrangler pages secret put SUPABASE_KEY --project-name 10x-cards

# Verify:
wrangler pages secret list --project-name 10x-cards
# Expected: two entries, both marked "encrypted"
```

---

## Phase 3 — First Deploy

After Phases 1 and 2 are complete, commit and push:

```bash
git add wrangler.jsonc .github/workflows/deploy.yml
git commit -m "chore: configure Cloudflare Pages deploy"
git push origin master
```

The `Deploy` workflow triggers. First run will prompt wrangler to create the `10x-cards` Pages project — the action handles this automatically.

**CLI fallback** (bypass GitHub Actions for immediate first deploy):
```bash
npm run build
wrangler pages deploy ./dist --project-name 10x-cards
# First run may ask to create the project — answer yes
```

---

## Phase 4 — Verification

```bash
wrangler tail --project-name 10x-cards --format pretty
```

While tailing, exercise in the browser:
1. **Auth flow (FR-001):** sign up → confirm email → sign in → sign out
2. Check tail for: no 500 errors, no `undefined` for SUPABASE vars, CPU time column

In GitHub Actions tab: confirm both `CI` and `Deploy` jobs show green on the push event.

Deployed URL: `https://10x-cards.pages.dev`

---

## Phase 5 — Post-Deploy Hardening (Do Before Seeding Real User Data)

Preview URLs (`*.10x-cards.pages.dev`) are public by default. Per the risk register, protect them with Cloudflare Access before any real user flashcard data is seeded.

1. Go to https://one.dash.cloudflare.com → Access → Applications → Add → Self-hosted
2. Application domain: `*.10x-cards.pages.dev` (wildcard)
3. Policy: allow only your email (or identity provider group)
4. Leave bare `10x-cards.pages.dev` unprotected (production stays open)

---

## Sequencing Summary

```
[AUTO]   Fix wrangler.jsonc (name="10x-cards", add disable_nodejs_process_v2) ✅
[AUTO]   Create .github/workflows/deploy.yml ✅
         ↓
[MANUAL] wrangler login → copy account ID
[MANUAL] Create Cloudflare API token (Pages Edit + Account Settings Read)
[MANUAL] Add 4 GitHub secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
         SUPABASE_URL, SUPABASE_KEY)
[MANUAL] wrangler pages secret put SUPABASE_URL + SUPABASE_KEY
         ↓
[DEPLOY] git push origin master  (triggers Deploy workflow)
         OR: npm run build && wrangler pages deploy ./dist --project-name 10x-cards
         ↓
[VERIFY] wrangler tail + browser: auth flow + no 500 errors
         ↓
[HARDEN] Cloudflare Access on *.10x-cards.pages.dev (before real user data)
```

---

## Risk Register Coverage

| Risk (from infrastructure.md) | How Addressed |
|---|---|
| `disable_nodejs_process_v2` missing → opaque 500s (H/H) | Phase 1a: flag added to `wrangler.jsonc` ✅ |
| `wrangler deploy` wrong command (H/M) | Phase 1b + Phase 3: `wrangler pages deploy` only ✅ |
| `SUPABASE_*` undefined at runtime (H/H) | Phase 2d: `wrangler pages secret put` before first deploy |
| Preview URLs public by default (M/M) | Phase 5: Cloudflare Access on wildcard subdomain |
| AI endpoint CPU > 10ms free-tier (M/L) | Phase 4 verification: monitor `wrangler tail` CPU column |

---

## Critical Files

| File | Status |
|---|---|
| `wrangler.jsonc` | Updated ✅ |
| `.github/workflows/deploy.yml` | Created ✅ |
| `.github/workflows/ci.yml` | No change needed |
| `astro.config.mjs` | No change needed |
