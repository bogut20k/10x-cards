import React, { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlashcardDraft } from "@/types";

const MAX_CHARS = 2000;
const WARN_CHARS = 1900;

export default function GenerateForm() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<FlashcardDraft[] | null>(null);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = (await res.json()) as { cards?: FlashcardDraft[]; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Coś poszło nie tak. Spróbuj ponownie.");
      } else {
        setCards(data.cards ?? []);
      }
    } catch {
      setError("Błąd połączenia. Sprawdź internet i spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
        <h1 className="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
          Generuj fiszki
        </h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="text" className="mb-2 block text-sm font-medium text-blue-100/80">
              Wklej tekst do nauki
            </label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
              }}
              maxLength={MAX_CHARS}
              rows={8}
              placeholder="Wklej tutaj notatki, fragment podręcznika lub inny tekst..."
              className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-blue-100/40 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
            />
            <p
              className={cn(
                "mt-1 text-right text-xs",
                text.length >= WARN_CHARS ? "text-amber-400" : "text-blue-100/40",
              )}
            >
              {text.length}/{MAX_CHARS}
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || text.trim().length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generuję...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generuj fiszki
              </>
            )}
          </button>
        </form>
      </div>

      {cards !== null && (
        <p className="mt-4 text-center text-sm text-blue-100/60">
          Wygenerowano {cards.length} fiszek — review UI wkrótce (Phase 3)
        </p>
      )}
    </div>
  );
}
