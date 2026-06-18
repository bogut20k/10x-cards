# AI Flashcard Generation and Review Implementation Plan

## Overview

Build the S-01 vertical slice: a `/generate` page where the user pastes text, Claude Haiku generates 3–20 flashcards, the user reviews/edits/deletes them inline, then saves all to Supabase with a redirect to `/dashboard`.

## Current State Analysis

- `src/middleware.ts` already protects `/generate` (F-00 done ✓)
- `src/lib/supabase.ts` provides `createClient()` for API routes
- React island pattern established in `src/components/auth/SignInForm.tsx`
- `src/types.ts` does not exist — needs to be created
- `@anthropic-ai/sdk` not installed — needs to be added as dependency
- F-01 (`flashcard-schema-and-rls`) not yet done — `flashcards` table doesn't exist in Supabase; Phase 3 save endpoint is blocked until F-01 completes

### Key Discoveries:

- `src/middleware.ts:4`: `/generate` is already in `PROTECTED_PAGE_ROUTES` — no per-route auth guard needed
- `src/pages/api/auth/signin.ts`: API pattern uses `export const POST: APIRoute`, `context.locals.user` set by middleware, `new Response(JSON.stringify(...))` for JSON responses
- `src/layouts/Layout.astro`: all pages wrap content with `<Layout title="...">` + `<slot />`
- `astro.config.mjs`: env schema uses `envField.string({ context: "server", access: "secret" })` — same pattern for ANTHROPIC_API_KEY
- `src/components/auth/SignInForm.tsx`: island props from parent `.astro`, `useState` for local state, `cn()` for class merging, Lucide icons, `useFormStatus()` for pending

## Desired End State

A logged-in user on `/generate`:
1. Types/pastes text (max 2000 chars) and clicks "Generuj"
2. Sees a loading spinner while Claude Haiku processes
3. Sees 3–20 generated flashcards (front/back) below the form, with a dismissible AI warning banner
4. Can click any card to edit front/back inline; can click X to delete a card
5. Clicks "Zapisz wszystkie" → cards saved to DB → redirect to `/dashboard?saved=N`
6. Dashboard shows "Zapisano N fiszek!" success banner

If AI API fails: error message appears above the form, text input stays filled for retry.

## What We're NOT Doing

- Streaming AI response (SSE/chunked transfer)
- Per-card checkbox selection (only "save all" or delete)
- Auto-retry on AI failure
- Per-card AI disclaimer (top-level banner only)
- Separate `/review` page (results on same `/generate` page)
- Text input > 2000 chars
- User control over number of generated cards
- Deck/collection grouping (all cards go to single user collection)

## Implementation Approach

Three phases in dependency order:

1. **AI generation endpoint** — install SDK, add env var, create types, build `/api/flashcards/generate` (testable independently of UI and F-01)
2. **Generate page + form UI** — page shell + React island with textarea, char counter, submit, loader, error display
3. **Review UI + save** — extend island to render cards, inline editing, delete, "Save all" → `/api/flashcards` (requires F-01) → redirect

## Critical Implementation Details

**F-01 dependency**: Phase 3's save endpoint (`/api/flashcards/index.ts`) requires the `flashcards` table to exist in Supabase. Do not implement Phase 3 until F-01 (`flashcard-schema-and-rls`) is complete and migrated.

**Anthropic SDK on Cloudflare Workers**: Use `@anthropic-ai/sdk` v0.20+. The SDK supports Cloudflare Workers (uses fetch internally). Pass `ANTHROPIC_API_KEY` from `astro:env/server` directly to the `Anthropic` constructor — do not use `process.env`.

**Claude response format**: The endpoint must instruct Claude via system prompt to return ONLY a valid JSON array (no markdown, no prose). Parse with `JSON.parse()` in try/catch; on parse failure return 500. This is load-bearing — the UI depends on clean JSON.

---

## Phase 1: AI Generation Endpoint

### Overview

Install the Anthropic SDK, register ANTHROPIC_API_KEY in Astro's env schema and local secrets, define shared types, and build the POST `/api/flashcards/generate` endpoint that calls Claude Haiku and returns a JSON array of flashcard drafts.

### Changes Required:

#### 1. Install Anthropic SDK

**File**: `package.json` (via npm install)

**Intent**: Add `@anthropic-ai/sdk` as a production dependency for calling the Claude API from Cloudflare Workers.

**Contract**: Run `npm install @anthropic-ai/sdk`. Updates `package.json` and `package-lock.json`.

#### 2. Shared types

**File**: `src/types.ts` (new)

**Intent**: Define `FlashcardDraft` (generation/review shape) and `Flashcard` (DB shape after save) used across the endpoint, the UI island, and future slices.

**Contract**:
```typescript
export interface FlashcardDraft {
  front: string;
  back: string;
}

export interface Flashcard extends FlashcardDraft {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}
```

#### 3. Env schema — ANTHROPIC_API_KEY

**File**: `astro.config.mjs`

**Intent**: Register `ANTHROPIC_API_KEY` as a server-only secret in Astro's env schema so it's importable via `astro:env/server`.

**Contract**: Add to the existing `env` → `schema` block alongside SUPABASE_URL/SUPABASE_KEY:
```typescript
ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret" }),
```

#### 4. Local env secret

**File**: `.dev.vars`

**Intent**: Provide the actual Anthropic API key for Cloudflare workerd local dev. This file is gitignored.

**Contract**: Add line `ANTHROPIC_API_KEY=<actual-key>`. Pattern matches existing SUPABASE_URL/SUPABASE_KEY entries.

#### 5. AI generation endpoint

**File**: `src/pages/api/flashcards/generate.ts` (new)

**Intent**: POST endpoint that validates the text input, calls Claude Haiku with a JSON-only prompt, parses the response, and returns `{ cards: FlashcardDraft[] }` to the client for review.

**Contract**:
- Export: `export const POST: APIRoute`
- Auth: `context.locals.user` guaranteed by middleware — no re-check needed
- Request: `await context.request.json()` → extract `text: string`
- Validation: `text` must be non-empty string, `text.length <= 2000`; return 400 with `{ error: string }` on failure
- Claude call: model `claude-haiku-4-5-20251001`, max_tokens 2048; system prompt instructs Claude to return ONLY a JSON array of `{ "front": "...", "back": "..." }` objects with 3–20 items, no markdown or prose; user message is the input text
- Parse: `JSON.parse()` the first content block text in try/catch; on failure return 500
- Success: `new Response(JSON.stringify({ cards }), { status: 200, headers: { "Content-Type": "application/json" } })`
- AI/network error: return 500 with `{ error: "Generowanie nie powiodło się. Spróbuj ponownie." }`

### Success Criteria:

#### Automated Verification:

- Type checking and linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- POST `/api/flashcards/generate` with valid text (logged in) → 200 with `{ cards: [...] }`
- Response cards array has 3–20 items, each with non-empty `front` and `back` strings
- POST with `text` > 2000 chars → 400
- POST with empty `text` → 400

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to Phase 2. Phase blocks use plain bullets — checkboxes live in `## Progress` below.

---

## Phase 2: Generate Page + Form UI

### Overview

Create the `/generate` page shell and the `GenerateForm` React island. Phase 2 scope: text input with char counter, submit triggers API call, loading state (spinner), error state (message + form stays filled). Card rendering is stubbed — review UI is added in Phase 3.

### Changes Required:

#### 1. Generate page

**File**: `src/pages/generate.astro` (new)

**Intent**: Protected page shell that mounts the GenerateForm island inside the shared layout.

**Contract**: Frontmatter imports `Layout` and `GenerateForm`. Template: `<Layout title="Generuj fiszki"><GenerateForm client:load /></Layout>`. No server-side data needed — island handles all state.

#### 2. GenerateForm React island — input + loading + error

**File**: `src/components/flashcards/GenerateForm.tsx` (new)

**Intent**: Island managing the text input → generate API call → results state. Phase 2 delivers the form half; Phase 3 adds the review half below.

**Contract**:
- State: `text` (string), `isLoading` (boolean), `error` (string | null), `cards` (FlashcardDraft[] | null)
- Textarea: controlled, `maxLength={2000}`, shows `{text.length}/2000` counter below; counter uses warning color (e.g. Tailwind `text-amber-400`) when `text.length >= 1900`
- Submit button: disabled when `isLoading || text.trim().length === 0`; shows `<Loader2 className="animate-spin" />` (Lucide) when loading, otherwise "Generuj"
- On submit: `fetch("/api/flashcards/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })`; on non-ok response set `error` from response JSON; on ok set `cards`; clear `error` on new submit attempt
- Error display: render error message above the textarea (ServerError pattern or styled div); error persists until next submit attempt
- Loading: button shows spinner; textarea remains enabled
- After success: `cards` state is set — Phase 3 renders the review section conditionally on `cards !== null`
- Use `cn()` from `@/lib/utils` for class merging; import `FlashcardDraft` from `@/types`

### Success Criteria:

#### Automated Verification:

- Type checking and linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Navigate to `/generate` logged in → form renders with textarea and "Generuj" button
- Type text → char counter updates live
- Reach 1900+ chars → counter changes to warning color
- 2000 chars → maxLength prevents further input
- Empty textarea → "Generuj" button is disabled
- Click "Generuj" with text → spinner appears, button disabled
- Successful API response → loading ends, `cards` set (no visible change yet — Phase 3)
- Simulated API error (bad key in .dev.vars) → error message appears above textarea; text stays in textarea

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to Phase 3. Phase blocks use plain bullets — checkboxes live in `## Progress` below.

---

## Phase 3: Review UI + Save

### Overview

**Requires F-01 (`flashcard-schema-and-rls`) to be complete before implementing the save endpoint.**

Extend `GenerateForm` to render generated cards below the form: dismissible AI warning banner, per-card inline editing, per-card delete, "Zapisz wszystkie" button that POSTs to `/api/flashcards`. Build the save endpoint. Add success banner to `/dashboard`.

### Changes Required:

#### 1. Card review section in GenerateForm

**File**: `src/components/flashcards/GenerateForm.tsx` (modify)

**Intent**: When `cards` state is non-null, render the review section below the form with the AI banner, editable cards, and save button.

**Contract**:
- AI banner: rendered above cards when `!bannerDismissed`; `bannerDismissed` boolean state; X button sets it to true; text: "AI może popełniać błędy — sprawdź fiszki przed zapisem"
- Card list: `cards.map((card, i) => ...)` — each card shows `front` / `back` text
- Inline edit: `editingIndex` (number | null) state; clicking a card's body sets `editingIndex = i`; when editing, render two textareas (front, back) with current values; on blur or Escape key → exit edit and update the corresponding entry in `cards` array
- Delete: each card has an X/trash button; `onClick` filters card out of `cards` array
- `isSaving` boolean state; "Zapisz wszystkie" button: disabled when `cards.length === 0 || isSaving`; shows spinner when saving
- On save: `fetch("/api/flashcards", { method: "POST", headers: ..., body: JSON.stringify({ cards }) })`; on ok → `window.location.href = `/dashboard?saved=${cards.length}``; on error → set save error message above the save button
- Import `FlashcardDraft` from `@/types`

#### 2. Save endpoint

**File**: `src/pages/api/flashcards/index.ts` (new)

**Intent**: POST endpoint that bulk-inserts the reviewed flashcard drafts into the `flashcards` table for the authenticated user. Requires F-01 schema to exist.

**Contract**:
- Export: `export const POST: APIRoute`
- Auth: extract `user.id` from `context.locals.user` (guaranteed by middleware)
- Request: `await context.request.json()` → `{ cards: FlashcardDraft[] }`
- Validation: `cards` must be non-empty array, each item has non-empty `front` and `back` → 400 on failure
- DB insert: `supabase.from("flashcards").insert(cards.map(c => ({ front: c.front, back: c.back, user_id: user.id })))` — column names match F-01 migration
- Success: `new Response(JSON.stringify({ saved: cards.length }), { status: 200, headers: { "Content-Type": "application/json" } })`
- DB error: 500 with `{ error: "Nie udało się zapisać fiszek." }`

#### 3. Dashboard success banner

**File**: `src/pages/dashboard.astro` (modify)

**Intent**: After redirect from save, show a success message when `?saved=N` query param is present.

**Contract**: In frontmatter: `const saved = Astro.url.searchParams.get("saved");`. In template: conditionally render a styled success div (e.g. green-tinted, positioned above main content) with text `Zapisano ${saved} fiszek!` when `saved` is not null. Static Astro — no island needed.

### Success Criteria:

#### Automated Verification:

- Type checking and linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- After generation, cards render below the form
- AI warning banner is visible and can be dismissed with X
- Clicking a card body → inline textareas appear for front and back
- Editing inline → card preview updates after leaving edit mode
- Clicking delete on a card → card removed from list
- All cards deleted → "Zapisz wszystkie" button is disabled
- Click "Zapisz wszystkie" → redirect to `/dashboard?saved=N`
- Dashboard shows "Zapisano N fiszek!" success banner
- Cards appear in `flashcards` table in Supabase with correct `user_id`

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding. Phase blocks use plain bullets — checkboxes live in `## Progress` below.

---

## Testing Strategy

### Manual Testing Steps:

1. Start dev server: `npm run dev`
2. Log in → navigate to `/generate`
3. Paste ~500 chars of study notes → click "Generuj" → verify loader appears
4. Verify 3–20 cards appear below with AI warning banner
5. Edit one card inline → verify textarea appears and preview updates after blur
6. Delete one card → verify it disappears from list
7. Click "Zapisz wszystkie" → verify redirect to `/dashboard` with success message
8. Open Supabase dashboard → verify cards in `flashcards` table with correct `user_id`
9. Error path: set wrong API key in `.dev.vars` → try generating → verify error message, text stays in textarea

## References

- Roadmap: `context/foundation/roadmap.md` — S-01
- PRD: `context/foundation/prd.md` — FR-002, FR-003, US-01
- Middleware: `src/middleware.ts` — `/generate` already in PROTECTED_PAGE_ROUTES (F-00)
- Supabase client: `src/lib/supabase.ts`
- React island pattern: `src/components/auth/SignInForm.tsx`
- F-01 dependency: `context/changes/flashcard-schema-and-rls/` — must be complete before Phase 3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: AI Generation Endpoint

#### Automated

- [x] 1.1 Type checking and linting passes: `npm run lint`
- [x] 1.2 Production build succeeds: `npm run build`

#### Manual

- [ ] 1.3 POST /api/flashcards/generate with valid text → 200 with cards array
- [ ] 1.4 Response has 3–20 cards with non-empty front and back
- [ ] 1.5 POST with text > 2000 chars → 400
- [ ] 1.6 POST with empty text → 400

### Phase 2: Generate Page + Form UI

#### Automated

- [ ] 2.1 Type checking and linting passes: `npm run lint`
- [ ] 2.2 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.3 /generate page renders with textarea and Generuj button
- [ ] 2.4 Char counter updates live; warning color at 1900+
- [ ] 2.5 Empty textarea → Generuj button disabled
- [ ] 2.6 Submit → spinner appears, button disabled
- [ ] 2.7 Valid text → API succeeds, loading ends
- [ ] 2.8 API error → error message above form, textarea filled

### Phase 3: Review UI + Save

#### Automated

- [ ] 3.1 Type checking and linting passes: `npm run lint`
- [ ] 3.2 Production build succeeds: `npm run build`

#### Manual

- [ ] 3.3 Cards render below form after generation
- [ ] 3.4 AI warning banner visible and dismissible
- [ ] 3.5 Click card → inline textareas for front/back
- [ ] 3.6 Delete card → card removed from list
- [ ] 3.7 Zapisz wszystkie → redirect to /dashboard
- [ ] 3.8 Dashboard shows "Zapisano N fiszek!" banner
- [ ] 3.9 Cards in Supabase flashcards table with correct user_id
