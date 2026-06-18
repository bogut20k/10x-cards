# Gate Product Routes Implementation Plan

## Overview

Extend `src/middleware.ts` to protect upcoming product pages (`/flashcards`, `/generate`, `/review`) and all domain API endpoints (`/api/*` except `/api/auth/*`) before they are built. Ensures new routes are automatically secured without per-route auth logic in each future slice.

## Current State Analysis

The middleware at `src/middleware.ts` guards only `["/dashboard"]` via `startsWith()` check and redirects unauthenticated requests to `/auth/signin`. Auth routes (`/api/auth/*`, `/auth/*`) and homepage are public. No domain API endpoints or product pages exist yet — they will be added by S-01 (`/generate`, `/api/flashcards/`), S-02 (`/review`), S-03/S-04 (also `/flashcards`).

### Key Discoveries:

- `src/middleware.ts:4`: `PROTECTED_ROUTES = ["/dashboard"]` — array iterated with `.some((route) => pathname.startsWith(route))`
- `src/middleware.ts:18`: redirect target is `/auth/signin` — unchanged
- All public auth API routes are under `/api/auth/` — safe to use as the public API prefix

## Desired End State

`src/middleware.ts` guards two categories:
- **Page routes**: `/dashboard`, `/flashcards`, `/generate`, `/review` — unauthenticated → redirect to `/auth/signin`
- **API routes**: all `/api/*` except `/api/auth/*` — unauthenticated → redirect to `/auth/signin`

Verification: hit each protected route/endpoint while logged out → receive a redirect to `/auth/signin`.

## What We're NOT Doing

- Not changing the response format for API routes (no 401 JSON — redirect is consistent with current pattern by user decision)
- Not creating any new page or API endpoint files
- Not adding per-route middleware decorators or Astro-level `prerender` guards

## Implementation Approach

Single-file modification to `src/middleware.ts`. Expand the page routes array to four entries and add a second condition for API route protection, reusing the same redirect pattern.

---

## Phase 1: Extend middleware route protection

### Overview

Update `src/middleware.ts` to protect four page routes and all non-auth API routes before any domain endpoint is built.

### Changes Required:

#### 1. Middleware route constants and guard

**File**: `src/middleware.ts`

**Intent**: Replace the single `PROTECTED_ROUTES` constant with two named constants (page routes list + public API prefix), then extend the guard condition to cover both page and API protection in one redirect check.

**Contract**:
- `PROTECTED_PAGE_ROUTES` array: `["/dashboard", "/flashcards", "/generate", "/review"]`
- Public API exception expressed as the prefix `"/api/auth"` (all auth endpoints share this prefix)
- Guard logic: unauthenticated request hits redirect when **either** `PROTECTED_PAGE_ROUTES.some(r => pathname.startsWith(r))` **or** `pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")`
- Redirect target `/auth/signin` is unchanged

### Success Criteria:

#### Automated Verification:

- Type checking and linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Navigate to `/flashcards` while logged out → redirected to `/auth/signin`
- Navigate to `/generate` while logged out → redirected to `/auth/signin`
- Navigate to `/review` while logged out → redirected to `/auth/signin`
- `fetch("/api/flashcards")` while logged out → 302 redirect response
- `fetch("/api/auth/signin", { method: "POST" })` while logged out → NOT redirected (public)
- Logged-in user accesses all protected routes → no redirect

**Implementation Note**: After automated verification passes, confirm manual testing before proceeding. Phase blocks use plain bullets — checkboxes live in `## Progress` below.

---

## Testing Strategy

### Manual Testing Steps:

1. Start dev server: `npm run dev`
2. Open browser in incognito mode (logged out)
3. Navigate to `/dashboard`, `/flashcards`, `/generate`, `/review` — each should redirect to `/auth/signin`
4. Open DevTools Network tab; run `fetch("/api/flashcards")` in console — expect 302
5. Run `fetch("/api/auth/signin", { method: "POST", body: new FormData() })` — expect a non-302 response (form error or 200, not redirect)
6. Sign in, repeat steps 3–4 — expect no redirects

## References

- Middleware: `src/middleware.ts`
- Auth API convention: `src/pages/api/auth/` (these are the public routes)
- Roadmap: `context/foundation/roadmap.md` — F-01 foundation, unlocks S-01 through S-04

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extend middleware route protection

#### Automated

- [x] 1.1 Type checking and linting passes: `npm run lint` — 129b203
- [x] 1.2 Production build succeeds: `npm run build` — 129b203

#### Manual

- [x] 1.3 /flashcards logged out → redirect to /auth/signin — 129b203
- [x] 1.4 /generate logged out → redirect to /auth/signin — 129b203
- [x] 1.5 /review logged out → redirect to /auth/signin — 129b203
- [x] 1.6 fetch("/api/flashcards") logged out → 302 redirect — 129b203
- [x] 1.7 fetch("/api/auth/signin") logged out → NOT redirected — 129b203
- [x] 1.8 Logged-in user accesses all protected routes → no redirect — 129b203
