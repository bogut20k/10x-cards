import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlashcardForReview, ReviewRating } from "@/types";

type Phase = "loading" | "front" | "back" | "done";

interface RatingConfig {
  rating: ReviewRating;
  label: string;
  previewKey: keyof FlashcardForReview["preview"];
  colorClass: string;
}

const RATING_CONFIG: RatingConfig[] = [
  {
    rating: 1,
    label: "Again",
    previewKey: "again",
    colorClass: "border-red-400/30 bg-red-500/10 hover:bg-red-500/20 text-red-300",
  },
  {
    rating: 2,
    label: "Hard",
    previewKey: "hard",
    colorClass: "border-orange-400/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300",
  },
  {
    rating: 3,
    label: "Good",
    previewKey: "good",
    colorClass: "border-green-400/30 bg-green-500/10 hover:bg-green-500/20 text-green-300",
  },
  {
    rating: 4,
    label: "Easy",
    previewKey: "easy",
    colorClass: "border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300",
  },
];

function formatTimeUntil(isoDate: string): string {
  const now = new Date();
  const due = new Date(isoDate);
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return "teraz";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.round(diffMs / 86_400_000);
  if (diffD === 1) return "1 dzień";
  if (diffD < 7) return `${diffD} dni`;
  const weeks = Math.round(diffD / 7);
  if (weeks === 1) return "1 tydzień";
  if (weeks < 5) return `${weeks} tygodnie`;
  return `${Math.round(diffD / 30)} mies.`;
}

export default function ReviewSession() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<FlashcardForReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }, [redirectPath]);

  useEffect(() => {
    fetch("/api/review/session")
      .then((r) => {
        if (r.redirected) {
          setRedirectPath("/auth/signin");
          return null;
        }
        return r.json() as Promise<{ cards?: FlashcardForReview[]; next_due?: string | null; error?: string }>;
      })
      .then((data) => {
        if (data === null) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        const fetched = data.cards ?? [];
        setCards(fetched);
        setNextDue(data.next_due ?? null);
        setPhase(fetched.length === 0 ? "done" : "front");
      })
      .catch(() => {
        setError("Błąd połączenia. Spróbuj ponownie.");
      });
  }, []);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      const card = cards[currentIndex];

      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: card.id, rating }),
      });

      if (res.redirected) {
        setRedirectPath("/auth/signin");
        return;
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex < cards.length) {
        setCurrentIndex(nextIndex);
        setPhase("front");
      } else {
        setPhase("done");
      }
    },
    [cards, currentIndex],
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (phase === "front" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setPhase("back");
        return;
      }
      if (phase === "back") {
        if (e.key === "1") void rate(1);
        else if (e.key === "2") void rate(2);
        else if (e.key === "3") void rate(3);
        else if (e.key === "4") void rate(4);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [phase, rate]);

  if (phase === "loading") {
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

  if (phase === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
          <p className="mb-2 text-4xl">🎉</p>
          <h2 className="mb-3 text-xl font-bold text-white">Gotowe na dziś!</h2>
          {nextDue ? (
            <p className="mb-6 text-sm text-blue-100/60">
              Wróć za <span className="font-semibold text-purple-300">{formatTimeUntil(nextDue)}</span>
            </p>
          ) : (
            <p className="mb-6 text-sm text-blue-100/60">Nie masz więcej fiszek do powtórzenia.</p>
          )}
          <a
            href="/dashboard"
            className="inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-blue-100/80 hover:bg-white/10"
          >
            Wróć do dashboardu
          </a>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-100/40">
            {currentIndex + 1}/{cards.length}
          </span>
          <a href="/dashboard" className="text-xs text-blue-100/30 hover:text-blue-100/60">
            Wyjdź
          </a>
        </div>

        <div
          onClick={() => {
            if (phase === "front") setPhase("back");
          }}
          className={cn(
            "rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition-colors",
            phase === "front" && "cursor-pointer hover:border-purple-400/30 hover:bg-purple-500/10",
          )}
        >
          <p className="text-center text-lg font-semibold text-white">{card.front}</p>
          {phase === "back" && (
            <>
              <div className="my-5 border-t border-white/10" />
              <p className="text-center text-base text-blue-100/80">{card.back}</p>
            </>
          )}
          {phase === "front" && (
            <p className="mt-4 text-center text-xs text-blue-100/30">Kliknij lub naciśnij Spację</p>
          )}
        </div>

        {phase === "back" && (
          <div className="grid grid-cols-4 gap-2">
            {RATING_CONFIG.map(({ rating, label, previewKey, colorClass }) => (
              <button
                key={rating}
                onClick={() => void rate(rating)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                  colorClass,
                )}
              >
                <span className="font-semibold">{label}</span>
                <span className="text-[10px] opacity-70">{card.preview[previewKey]}</span>
                <span className="text-[10px] opacity-40">[{rating}]</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
