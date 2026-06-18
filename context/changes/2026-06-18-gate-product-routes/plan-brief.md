# Gate Product Routes — Plan Brief

> Full plan: `context/changes/gate-product-routes/plan.md`

## What & Why

Extend the auth middleware to protect the product routes that S-01 through S-04 will build, before those routes exist. Without this change, every future slice would need to add its own per-route auth guard — this does it once, centrally.

## Starting Point

`src/middleware.ts` today protects only `["/dashboard"]`. No domain pages (`/flashcards`, `/generate`, `/review`) or domain API endpoints (`/api/flashcards/*`) exist yet.

## Desired End State

A logged-out user hitting any of `/flashcards`, `/generate`, `/review`, or any `/api/*` route (except `/api/auth/*`) is redirected to `/auth/signin`. Logged-in users pass through. The auth endpoints remain public.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Page route structure | Top-level (`/flashcards`, `/generate`, `/review`) | User preference — cleaner URLs |
| API protection | All `/api/*` except `/api/auth/*` | Secure-by-default for domain endpoints |
| API response on unauth | Redirect (302) to `/auth/signin` | Consistent with current page behavior; no JSON 401 |

## Scope

**In scope:**
- Extend `PROTECTED_PAGE_ROUTES` to 4 entries: `/dashboard`, `/flashcards`, `/generate`, `/review`
- Add API route guard: `/api/*` minus `/api/auth/*` → redirect if unauthenticated

**Out of scope:**
- New page or API files (those come in S-01–S-04)
- 401 JSON responses for API routes
- Per-route middleware decorators

## Architecture / Approach

Single file change in `src/middleware.ts`. Two named constants replace the current one-liner array; the `onRequest` guard gets an OR condition covering both page routes and API routes. Redirect target (`/auth/signin`) unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Extend middleware | Protected page + API routes | None significant — 1 file, established pattern |

**Prerequisites:** None — independent of F-01 (DB schema not needed for middleware)
**Estimated effort:** ~1 session, single file edit

## Open Risks & Assumptions

- Future domain routes must follow the `/flashcards`, `/generate`, `/review` prefixes — new top-level routes outside this list won't be auto-protected
- If `/api/auth/` prefix ever changes, `PUBLIC_API_PREFIX` constant must be updated

## Success Criteria (Summary)

- Logged-out user is redirected from all 3 new page routes and `/api/*` domain endpoints
- Auth endpoints (`/api/auth/*`) remain publicly accessible
- `npm run lint` and `npm run build` pass clean
