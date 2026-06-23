import React, { useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlashcardDraft } from "@/types";

export default function ManualCardForm() {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFrontChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setFront(e.target.value);
    setSuccess(false);
  }

  function handleBackChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBack(e.target.value);
    setSuccess(false);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const card: FlashcardDraft = { front: front.trim(), back: back.trim() };

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: [card] }),
      });

      if (res.ok) {
        setFront("");
        setBack("");
        setSuccess(true);
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nie udało się zapisać fiszki.");
      }
    } catch {
      setError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = front.trim().length > 0 && back.trim().length > 0 && !isLoading;

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-xl font-bold text-transparent">
            Utwórz fiszkę
          </h2>
          <a
            href="/generate"
            className="flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
          >
            <Sparkles className="size-3" />
            Generuj z AI
          </a>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-400/30 bg-green-500/15 px-4 py-3 text-sm text-green-200">
            Fiszka zapisana!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="front" className="mb-1.5 block text-sm font-medium text-blue-100/80">
              Przód <span className="text-blue-100/40">(pytanie lub pojęcie)</span>
            </label>
            <textarea
              id="front"
              value={front}
              onChange={handleFrontChange}
              rows={3}
              placeholder="Pytanie lub pojęcie..."
              className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-blue-100/40 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="back" className="mb-1.5 block text-sm font-medium text-blue-100/80">
              Tył <span className="text-blue-100/40">(odpowiedź lub definicja)</span>
            </label>
            <textarea
              id="back"
              value={back}
              onChange={handleBackChange}
              rows={4}
              placeholder="Odpowiedź lub definicja..."
              className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-blue-100/40 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors",
              canSubmit ? "bg-purple-600 hover:bg-purple-500" : "cursor-not-allowed bg-purple-600/40 opacity-50",
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Zapisuję...
              </>
            ) : (
              <>
                <Plus className="size-4" />
                Zapisz fiszkę
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
