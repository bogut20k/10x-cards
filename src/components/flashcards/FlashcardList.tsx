import React, { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types";

const MAX_FRONT = 500;
const MAX_BACK = 2000;

type SortBy = "newest" | "oldest" | "az";

interface PendingDelete {
  id: string;
  card: Flashcard;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

interface Toast {
  message: string;
  isUndo: boolean;
}

function sortFlashcards(cards: Flashcard[], sortBy: SortBy): Flashcard[] {
  return [...cards].sort((a, b) => {
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.front.localeCompare(b.front);
  });
}

export default function FlashcardList() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/flashcards")
      .then((r) => r.json())
      .then((data: { flashcards?: Flashcard[]; error?: string }) => {
        if (data.flashcards) setFlashcards(data.flashcards);
        else setError(data.error ?? "Nie udało się pobrać fiszek.");
      })
      .catch(() => {
        setError("Błąd połączenia. Spróbuj ponownie.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function showToast(message: string, isUndo: boolean) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, isUndo });
    if (!isUndo) {
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, 4000);
    }
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (editFront.trim().length === 0 || editFront.length > MAX_FRONT) return;
    if (editBack.trim().length === 0 || editBack.length > MAX_BACK) return;

    setEditSaving(true);
    setEditError(null);

    const prev = flashcards.find((c) => c.id === id);

    try {
      const res = await fetch(`/api/flashcards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: editFront.trim(), back: editBack.trim() }),
      });
      const data = (await res.json()) as { flashcard?: Flashcard; error?: string };
      if (res.ok && data.flashcard) {
        const updated = data.flashcard;
        setFlashcards((prev_) => prev_.map((c) => (c.id === id ? updated : c)));
        setEditingId(null);
      } else {
        if (prev) setFlashcards((prev_) => prev_.map((c) => (c.id === id ? prev : c)));
        setEditError(data.error ?? "Nie udało się zapisać zmian.");
      }
    } catch {
      if (prev) setFlashcards((prev_) => prev_.map((c) => (c.id === id ? prev : c)));
      setEditError("Błąd połączenia. Spróbuj ponownie.");
    } finally {
      setEditSaving(false);
    }
  }

  function deleteCard(card: Flashcard) {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      void fetch(`/api/flashcards/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
    }

    const index = flashcards.findIndex((c) => c.id === card.id);
    setFlashcards((prev) => prev.filter((c) => c.id !== card.id));
    if (editingId === card.id) setEditingId(null);

    const timer = setTimeout(() => {
      void fetch(`/api/flashcards/${card.id}`, { method: "DELETE" }).then((res) => {
        if (!res.ok) {
          setFlashcards((prev) => {
            const next = [...prev];
            next.splice(index, 0, card);
            return next;
          });
          showToast("Nie udało się usunąć fiszki.", false);
        }
      });
      setPendingDelete(null);
      setToast(null);
    }, 5000);

    setPendingDelete({ id: card.id, card, index, timer });
    showToast("Usunięto", true);
  }

  function undoDelete() {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setFlashcards((prev) => {
      const next = [...prev];
      next.splice(pendingDelete.index, 0, pendingDelete.card);
      return next;
    });
    setPendingDelete(null);
    setToast(null);
  }

  const sorted = sortFlashcards(flashcards, sortBy);

  const frontInvalid = editFront.trim().length === 0 || editFront.length > MAX_FRONT;
  const backInvalid = editBack.trim().length === 0 || editBack.length > MAX_BACK;
  const canSave = !frontInvalid && !backInvalid && !editSaving;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
        <Loader2 className="size-8 animate-spin text-purple-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/20 p-6 text-center text-red-200">
          <p className="mb-4">{error}</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="rounded-lg bg-red-500/30 px-4 py-2 text-sm font-medium hover:bg-red-500/50"
          >
            Odśwież stronę
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 pb-24">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between py-4">
          <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
            Moje fiszki
          </h1>
          <a
            href="/generate"
            className="flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
          >
            <Sparkles className="size-3" />
            Generuj z AI
          </a>
        </div>

        {flashcards.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-10 text-center backdrop-blur-xl">
            <p className="mb-4 text-blue-100/60">Nie masz jeszcze żadnych fiszek.</p>
            <div className="flex justify-center gap-3">
              <a
                href="/generate"
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
              >
                Generuj z AI
              </a>
              <a
                href="/dashboard"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-blue-100/80 hover:bg-white/10"
              >
                Dashboard
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-100/50">Sortuj:</span>
              {(["newest", "oldest", "az"] as SortBy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSortBy(s);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                    sortBy === s
                      ? "bg-purple-600 text-white"
                      : "border border-white/10 text-blue-100/60 hover:bg-white/10",
                  )}
                >
                  {s === "newest" ? "Najnowsze" : s === "oldest" ? "Najstarsze" : "A–Z"}
                </button>
              ))}
              <span className="ml-auto text-xs text-blue-100/40">{flashcards.length} fiszek</span>
            </div>

            <div className="space-y-3">
              {sorted.map((card) =>
                editingId === card.id ? (
                  <div key={card.id} className="rounded-2xl border border-blue-400/30 bg-white/10 p-5 backdrop-blur-xl">
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-xs font-medium text-blue-100/70">Przód</label>
                          <span
                            className={cn(
                              "text-xs",
                              editFront.length > MAX_FRONT ? "text-red-400" : "text-blue-100/40",
                            )}
                          >
                            {editFront.length}/{MAX_FRONT}
                          </span>
                        </div>
                        <textarea
                          value={editFront}
                          onChange={(e) => {
                            setEditFront(e.target.value);
                          }}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-blue-100/40 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
                        />
                        {editFront.trim().length === 0 && (
                          <p className="mt-1 text-xs text-red-400">Pole nie może być puste.</p>
                        )}
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-xs font-medium text-blue-100/70">Tył</label>
                          <span
                            className={cn("text-xs", editBack.length > MAX_BACK ? "text-red-400" : "text-blue-100/40")}
                          >
                            {editBack.length}/{MAX_BACK}
                          </span>
                        </div>
                        <textarea
                          value={editBack}
                          onChange={(e) => {
                            setEditBack(e.target.value);
                          }}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-blue-100/40 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50 focus:outline-none"
                        />
                        {editBack.trim().length === 0 && (
                          <p className="mt-1 text-xs text-red-400">Pole nie może być puste.</p>
                        )}
                      </div>
                      {editError && (
                        <p className="rounded-lg border border-red-400/30 bg-red-500/20 px-3 py-2 text-xs text-red-200">
                          {editError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => void saveEdit(card.id)}
                          disabled={!canSave}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors",
                            canSave
                              ? "bg-purple-600 hover:bg-purple-500"
                              : "cursor-not-allowed bg-purple-600/40 opacity-50",
                          )}
                        >
                          {editSaving && <Loader2 className="size-3 animate-spin" />}
                          Zapisz
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-blue-100/60 hover:bg-white/10"
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={card.id}
                    className="group rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl transition-colors hover:border-white/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => {
                          startEdit(card);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="mb-1 text-sm font-semibold text-white">{card.front}</p>
                        <p className="text-sm text-blue-100/60">{card.back}</p>
                      </button>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => {
                            startEdit(card);
                          }}
                          className="rounded-lg p-1.5 text-blue-100/40 hover:bg-white/10 hover:text-blue-100"
                          aria-label="Edytuj fiszkę"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            deleteCard(card);
                          }}
                          className="rounded-lg p-1.5 text-blue-100/40 hover:bg-red-500/20 hover:text-red-300"
                          aria-label="Usuń fiszkę"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white shadow-xl">
            <span>{toast.message}</span>
            {toast.isUndo && (
              <button onClick={undoDelete} className="font-semibold text-purple-300 hover:text-purple-200">
                Cofnij
              </button>
            )}
            {!toast.isUndo && (
              <button
                onClick={() => {
                  setToast(null);
                }}
                className="text-blue-100/40 hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
