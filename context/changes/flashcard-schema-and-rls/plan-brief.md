# Flashcard Schema and RLS — Plan Brief

> Full plan: `context/changes/flashcard-schema-and-rls/plan.md`

## What & Why

Create the `flashcards` table in Supabase — the foundational data layer for the entire app. Without it, S-01 can't save generated cards, S-02 can't run review sessions, and S-03 can't accept manual cards. Every downstream slice is blocked until this lands.

## Starting Point

No domain tables exist yet. `supabase/migrations/` doesn't exist, `schema_paths = []`. The remote Supabase project is linked (`ref: uebytioeeilxnsurhrwg`) and auth is fully working. The `Flashcard` TypeScript type in `src/types.ts` already names the columns this migration must match.

## Desired End State

A `flashcards` table in the remote Supabase database with content columns (`id, user_id, front, back, created_at, updated_at`), FSRS spaced repetition state columns inline, RLS that restricts each row to its owner, and an `updated_at` trigger. `supabase/migrations/` is initialized with the first migration file under version control.

## Key Decisions Made

| Decision          | Choice                                          | Why (1 sentence)                                                                        | Source |
| ----------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| SR state location | Inline columns in `flashcards`                  | S-02 queries need no JOIN — simpler queries and less code                               | Plan   |
| SR algorithm      | FSRS (ts-fsrs compatible)                       | Modern algorithm, maintained TypeScript library, better scheduling than SM-2            | Plan   |
| Migration deploy  | `supabase db push` via CLI                      | Matches CLAUDE.md convention; migration is version-controlled in `supabase/migrations/` | Plan   |
| RLS scope         | Single `FOR ALL` policy with USING + WITH CHECK | USING alone doesn't block writes — both clauses required                                | Plan   |

## Scope

**In scope:**

- `flashcards` table with content + FSRS columns
- RLS enabled, single policy scoping all operations to `auth.uid() = user_id`
- `updated_at` auto-update trigger
- Indexes on `user_id` and `(user_id, due)`
- `supabase/migrations/` directory created

**Out of scope:**

- Separate decks/collections table
- `flashcard_review_state` separate table
- Soft delete / audit log
- Seed data

## Architecture / Approach

Single SQL migration file at `supabase/migrations/20260618000000_flashcard_schema.sql`. Applied to the already-linked remote project with `supabase db push`. The FSRS columns default sensibly (`state=0`, `due=NOW()`, others=0) so a freshly inserted card is immediately due with no SR history.

## Phases at a Glance

| Phase                     | What it delivers                         | Key risk                                                             |
| ------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| 1. Migration file + apply | flashcards table live in remote Supabase | `supabase db push` requires Supabase CLI installed and authenticated |

**Prerequisites:** Supabase CLI installed (`npm install supabase --save-dev` or global), authenticated (`supabase login`)
**Estimated effort:** ~1 session, single phase

## Open Risks & Assumptions

- `supabase db push` requires the CLI to be installed locally and authenticated — if not, the SQL can be run manually in the Supabase dashboard SQL editor as a fallback
- Column naming must stay in sync with `src/types.ts:Flashcard` — renaming either side breaks the S-01 Phase 3 save endpoint

## Success Criteria (Summary)

- `flashcards` table visible in Supabase Table Editor with all 16 columns
- RLS enabled, policy "Users own their flashcards" present
- INSERT, SELECT, UPDATE work correctly with auth.uid() scoping
