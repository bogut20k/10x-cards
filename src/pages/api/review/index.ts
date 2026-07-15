import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { fsrs, TypeConvert } from "ts-fsrs";
import type { ReviewRating } from "@/types";

export const POST: APIRoute = async (context) => {
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

  let card_id: string;
  let rating: ReviewRating;
  try {
    const body = (await context.request.json()) as { card_id?: unknown; rating?: unknown };
    const rawId = body.card_id;
    const rawRating = body.rating;

    if (typeof rawId !== "string" || rawId.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Brak wymaganego pola card_id." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (rawRating !== 1 && rawRating !== 2 && rawRating !== 3 && rawRating !== 4) {
      return new Response(JSON.stringify({ error: "Nieprawidłowa ocena. Dozwolone wartości: 1, 2, 3, 4." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    card_id = rawId;
    rating = rawRating;
  } catch {
    return new Response(JSON.stringify({ error: "Nieprawidłowe dane żądania." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { data: rawData, error: fetchError } = await supabase
      .from("flashcards")
      .select("id, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review")
      .eq("id", card_id)
      .single();

    if (fetchError) {
      return new Response(JSON.stringify({ error: "Fiszka nie istnieje." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = TypeConvert.card({
      due: rawData.due as string,
      stability: rawData.stability as number,
      difficulty: rawData.difficulty as number,
      elapsed_days: 0,
      scheduled_days: rawData.scheduled_days as number,
      learning_steps: rawData.learning_steps as number,
      reps: rawData.reps as number,
      lapses: rawData.lapses as number,
      state: rawData.state as number,
      last_review: rawData.last_review as string | null,
    });

    const scheduler = fsrs();
    const result = scheduler.next(card, new Date(), rating);
    const updated = result.card;

    const { error: updateError } = await supabase
      .from("flashcards")
      .update({
        due: updated.due.toISOString(),
        stability: updated.stability,
        difficulty: updated.difficulty,
        scheduled_days: updated.scheduled_days,
        learning_steps: updated.learning_steps,
        reps: updated.reps,
        lapses: updated.lapses,
        state: updated.state,
        last_review: updated.last_review ? updated.last_review.toISOString() : null,
      })
      .eq("id", card_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Błąd aktualizacji fiszki." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ updated: true }), {
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
