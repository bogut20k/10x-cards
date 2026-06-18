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
