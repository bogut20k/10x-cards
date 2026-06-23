import React, { useState } from "react";
import { Loader2, Sparkles, X, Pencil, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlashcardDraft } from "@/types";

const MAX_CHARS = 2000;
const WARN_CHARS = 1900;

export default function GenerateForm() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<FlashcardDraft[] | null>(null);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setCards(null);
    setBannerDismissed(false);

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

  function startEditing(index: number) {
    if (!cards) return;
    setEditingIndex(index);
    setEditFront(cards[index].front);
    setEditBack(cards[index].back);
  }

  function commitEdit() {
    if (editingIndex === null || !cards) return;
    const updated = cards.map((card, i) =>
      i === editingIndex ? { front: editFront.trim(), back: editBack.trim() } : card,
    );
    setCards(updated);
    setEditingIndex(null);
  }

  function deleteCard(index: number) {
    if (!cards) return;
    setCards(cards.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!cards || cards.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });

      if (res.ok) {
        window.location.href = `/dashboard?saved=${cards.length}`;
      } else {
        const data = (await res.json()) as { error?: string };
        setSaveError(data.error ?? "Nie udało się zapisać fiszek.");
      }
    } catch {
      setSaveError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Generate form */}
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

      {/* Review section */}
      {cards !== null && (
        <div className="space-y-4">
          {/* AI warning banner */}
          {!bannerDismissed && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <span>AI może popełniać błędy — sprawdź fiszki przed zapisem.</span>
              <button
                onClick={() => {
                  setBannerDismissed(true);
                }}
                className="mt-0.5 shrink-0 text-amber-200/60 hover:text-amber-200"
                aria-label="Zamknij"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Cards */}
          <div className="space-y-3">
            {cards.map((card, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
                {editingIndex === i ? (
                  <div className="space-y-3 p-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-blue-100/60">Przód</label>
                      <textarea
                        value={editFront}
                        onChange={(e) => {
                          setEditFront(e.target.value);
                        }}
                        rows={2}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") commitEdit();
                        }}
                        className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-blue-100/60">Tył</label>
                      <textarea
                        value={editBack}
                        onChange={(e) => {
                          setEditBack(e.target.value);
                        }}
                        rows={3}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") commitEdit();
                        }}
                        onBlur={commitEdit}
                        className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex cursor-pointer items-start justify-between gap-3 p-4 transition-colors hover:bg-white/5"
                    onClick={() => {
                      startEditing(i);
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="mb-0.5 text-xs font-medium text-blue-100/50">Przód</p>
                        <p className="text-sm text-white">{card.front}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-xs font-medium text-blue-100/50">Tył</p>
                        <p className="text-sm text-blue-100/80">{card.back}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(i);
                        }}
                        className="rounded p-1 text-blue-100/40 transition-colors hover:text-blue-200"
                        aria-label="Edytuj"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCard(i);
                        }}
                        className="rounded p-1 text-blue-100/40 transition-colors hover:text-red-300"
                        aria-label="Usuń"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save section */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <p className="mb-3 text-sm text-blue-100/60">
              {cards.length === 0
                ? "Wszystkie fiszki zostały usunięte."
                : `${cards.length} ${cards.length === 1 ? "fiszka gotowa" : cards.length < 5 ? "fiszki gotowe" : "fiszek gotowych"} do zapisu.`}
            </p>

            {saveError && (
              <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                {saveError}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={cards.length === 0 || isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Zapisuję...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Zapisz wszystkie
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
