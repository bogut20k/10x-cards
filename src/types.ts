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

export interface FlashcardForReview {
  id: string;
  front: string;
  back: string;
  // FSRS state — raw DB values (strings/numbers), TypeConvert.card() przetworzy je w API
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // 0=New 1=Learning 2=Review 3=Relearning
  last_review: string | null;
  // Pre-computed preview intervals (server-side repeat())
  preview: {
    again: string; // np. "10 min"
    hard: string; // np. "1 dzień"
    good: string; // np. "3 dni"
    easy: string; // np. "2 tygodnie"
  };
}

export interface ReviewSessionResponse {
  cards: FlashcardForReview[];
  next_due: string | null; // ISO timestamp najbliższej niedostępnej jeszcze karty
}

export type ReviewRating = 1 | 2 | 3 | 4; // Again=1 Hard=2 Good=3 Easy=4
