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
