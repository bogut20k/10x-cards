# Flashcard Schema and RLS Implementation Plan

## Overview

Create the `flashcards` table in Supabase with FSRS spaced repetition state columns inline, enable Row Level Security scoped to the owning user, and apply to the remote database via `supabase db push`. This is the foundational data layer that all flashcard slices (S-01, S-02, S-03, S-04) depend on.

## Current State Analysis

- `supabase/migrations/` does not exist — this change creates it and the first migration file.
- `supabase/config.toml:58` has `schema_paths = []` — no SQL schemas are currently tracked.
- Remote project is linked: ref `uebytioeeilxnsurhrwg` (`supabase/.temp/linked-project.json`).
- `src/types.ts` already defines `Flashcard` with `id, user_id, front, back, created_at, updated_at` — the migration column names must match exactly or the save endpoint in S-01 Phase 3 will break.
- Auth is Supabase-native, so `auth.uid()` works directly in RLS policies.

## Desired End State

A `flashcards` table exists in the remote Supabase database with:
- Content columns matching `src/types.ts:Flashcard` (`id, user_id, front, back, created_at, updated_at`)
- FSRS SR state columns inline (`stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review, due`)
- RLS enabled: each user can only SELECT/INSERT/UPDATE/DELETE their own rows
- `updated_at` auto-updates via trigger on every UPDATE
- Indexes on `user_id` and `(user_id, due)` for S-01/S-02 query patterns

### Key Discoveries:

- `src/types.ts:Flashcard` names must be preserved verbatim in the migration — `id`, `user_id`, `front`, `back`, `created_at`, `updated_at`
- FSRS `state` column: `0=New, 1=Learning, 2=Review, 3=Relearning` (ts-fsrs convention) — all new cards default to `0`
- FSRS `due` defaults to `NOW()` so every freshly inserted card is immediately due for review
- A composite index `(user_id, due)` covers the S-02 "fetch cards due for this user" query without a full table scan
- `ON DELETE CASCADE` on `user_id` ensures all flashcards are removed when the auth user is deleted — no orphan rows

## What We're NOT Doing

- No separate `flashcard_review_state` table — SR state is inline on `flashcards`
- No decks/collections table — all cards belong to a single user collection (per PRD §Non-Goals)
- No soft delete — `DELETE` removes rows permanently (S-04 can add this later if needed)
- No triggers beyond `updated_at` — no audit log, no notification hooks
- No seed data — migration creates the schema only

## Implementation Approach

One SQL migration file applied via Supabase CLI. The file goes in `supabase/migrations/` with a timestamp prefix so the CLI tracks it as applied and future migrations can follow it in order.

## Critical Implementation Details

**Migration filename prefix**: Supabase CLI expects filenames like `<YYYYMMDDHHmmss>_<name>.sql`. Use `20260618000000_flashcard_schema.sql`.

**RLS `WITH CHECK`**: The `WITH CHECK` clause on the INSERT/UPDATE path prevents a user from inserting a row with someone else's `user_id`. The `USING` clause alone does not block writes — both are required on a single `FOR ALL` policy.

**Function idempotency**: `CREATE OR REPLACE FUNCTION` makes the trigger function idempotent; `CREATE TRIGGER` is not — the trigger must be created only once. The migration runs once so this is fine for production, but local `supabase db reset` will re-apply it from scratch each time.

---

## Phase 1: Migration file + apply to remote

### Overview

Write the SQL migration, create the `supabase/migrations/` directory, and apply to the remote Supabase project with `supabase db push`.

### Changes Required:

#### 1. Migration SQL file

**File**: `supabase/migrations/20260618000000_flashcard_schema.sql` (new)

**Intent**: Define the complete `flashcards` table with content columns, FSRS SR state columns, RLS, trigger, and indexes — everything the flashcard feature surface needs from the database.

**Contract**:

```sql
-- flashcards: content + FSRS spaced repetition state
CREATE TABLE flashcards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front           TEXT        NOT NULL,
  back            TEXT        NOT NULL,
  -- FSRS state (ts-fsrs compatible; 0=New 1=Learning 2=Review 3=Relearning)
  stability       FLOAT       NOT NULL DEFAULT 0,
  difficulty      FLOAT       NOT NULL DEFAULT 0,
  elapsed_days    INTEGER     NOT NULL DEFAULT 0,
  scheduled_days  INTEGER     NOT NULL DEFAULT 0,
  reps            INTEGER     NOT NULL DEFAULT 0,
  lapses          INTEGER     NOT NULL DEFAULT 0,
  state           SMALLINT    NOT NULL DEFAULT 0,
  last_review     TIMESTAMPTZ,
  due             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX flashcards_user_id_idx  ON flashcards(user_id);
CREATE INDEX flashcards_user_due_idx ON flashcards(user_id, due);

-- Row Level Security
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their flashcards"
ON flashcards FOR ALL
USING     (auth.uid() = user_id)
WITH CHECK(auth.uid() = user_id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER flashcards_updated_at
BEFORE UPDATE ON flashcards
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Success Criteria:

#### Automated Verification:

- Migration file exists at the correct path: `ls supabase/migrations/20260618000000_flashcard_schema.sql`
- `supabase db push` exits with code 0 (no errors)

#### Manual Verification:

- Open Supabase dashboard → Table Editor → `flashcards` table exists with all columns listed above
- Open Authentication → Policies → `flashcards` table shows RLS enabled and one policy "Users own their flashcards"
- Run in SQL Editor: `INSERT INTO flashcards (user_id, front, back) VALUES (auth.uid(), 'Q', 'A');` while logged in → row inserted
- Run in SQL Editor: `SELECT * FROM flashcards;` → returns only rows owned by the current session user
- Run in SQL Editor: `UPDATE flashcards SET front = 'Q2' WHERE id = '<id>';` → `updated_at` column value changes

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to the commit step.

---

## References

- Roadmap: `context/foundation/roadmap.md` — F-01
- Types: `src/types.ts` — `Flashcard` interface column names must match
- Supabase config: `supabase/config.toml` — remote project linked at ref `uebytioeeilxnsurhrwg`
- Dependent change: `context/changes/ai-generation-and-review/plan.md` — Phase 3 save endpoint inserts into `flashcards`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration file + apply to remote

#### Automated

- [x] 1.1 Migration file exists at the correct path — 57ebcd0
- [x] 1.2 `supabase db push` exits with code 0 — 57ebcd0

#### Manual

- [x] 1.3 flashcards table visible in Supabase Table Editor with all columns — 57ebcd0
- [x] 1.4 RLS enabled on flashcards table with "Users own their flashcards" policy — 57ebcd0
- [x] 1.5 INSERT with auth.uid() succeeds; SELECT returns only own rows — 57ebcd0
- [x] 1.6 UPDATE changes updated_at value — 57ebcd0
