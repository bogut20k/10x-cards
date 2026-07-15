import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { fsrs, Rating, TypeConvert } from "ts-fsrs";
import type { FlashcardForReview, ReviewSessionResponse } from "@/types";

interface RawFlashcardRow {
  id: string;
  front: string;
  back: string;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

interface RawNextDueRow {
  due: string;
}

function formatInterval(due: Date, now: Date): string {
  const diffMs = due.getTime() - now.getTime();
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

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Nieautoryzowany dostęp." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Błąd konfiguracji serwera." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const scheduler = fsrs();

    const { data: rawDueData, error: dueError } = await supabase
      .from("flashcards")
      .select(
        "id, front, back, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review",
      )
      .lte("due", nowIso)
      .order("due", { ascending: true })
      .limit(20);

    if (dueError) {
      return new Response(JSON.stringify({ error: "Błąd pobierania fiszek." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: rawNextData, error: nextError } = await supabase
      .from("flashcards")
      .select("due")
      .gt("due", nowIso)
      .order("due", { ascending: true })
      .limit(1);

    if (nextError) {
      return new Response(JSON.stringify({ error: "Błąd pobierania kolejnej fiszki." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const dueRows = rawDueData as unknown as RawFlashcardRow[];
    const nextRows = rawNextData as unknown as RawNextDueRow[];

    const cards: FlashcardForReview[] = dueRows.map((raw) => {
      const card = TypeConvert.card({
        due: raw.due,
        stability: raw.stability,
        difficulty: raw.difficulty,
        elapsed_days: 0,
        scheduled_days: raw.scheduled_days,
        learning_steps: raw.learning_steps,
        reps: raw.reps,
        lapses: raw.lapses,
        state: raw.state,
        last_review: raw.last_review,
      });

      const preview = scheduler.repeat(card, now);

      return {
        id: raw.id,
        front: raw.front,
        back: raw.back,
        due: raw.due,
        stability: raw.stability,
        difficulty: raw.difficulty,
        scheduled_days: raw.scheduled_days,
        learning_steps: raw.learning_steps,
        reps: raw.reps,
        lapses: raw.lapses,
        state: raw.state,
        last_review: raw.last_review,
        preview: {
          again: formatInterval(preview[Rating.Again].card.due, now),
          hard: formatInterval(preview[Rating.Hard].card.due, now),
          good: formatInterval(preview[Rating.Good].card.due, now),
          easy: formatInterval(preview[Rating.Easy].card.due, now),
        },
      };
    });

    const response: ReviewSessionResponse = {
      cards,
      next_due: nextRows.length > 0 ? nextRows[0].due : null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Błąd serwera." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
