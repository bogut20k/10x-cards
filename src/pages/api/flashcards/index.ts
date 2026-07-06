import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { FlashcardDraft } from "@/types";

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front, back, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: "Nie udało się pobrać fiszek." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ flashcards: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Błąd konfiguracji serwera." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let cards: FlashcardDraft[];
  try {
    const body = (await context.request.json()) as { cards?: unknown };
    cards = (body.cards ?? []) as FlashcardDraft[];
  } catch {
    return new Response(JSON.stringify({ error: "Nieprawidłowe dane." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    !Array.isArray(cards) ||
    cards.length === 0 ||
    !cards.every(
      (c) =>
        typeof c === "object" &&
        typeof (c as Record<string, unknown>).front === "string" &&
        ((c as Record<string, unknown>).front as string).trim().length > 0 &&
        typeof (c as Record<string, unknown>).back === "string" &&
        ((c as Record<string, unknown>).back as string).trim().length > 0,
    )
  ) {
    return new Response(JSON.stringify({ error: "Brak fiszek do zapisania lub nieprawidłowy format." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("flashcards")
    .insert(cards.map((c) => ({ front: c.front.trim(), back: c.back.trim(), user_id: user?.id })));

  if (error) {
    return new Response(JSON.stringify({ error: "Nie udało się zapisać fiszek." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ saved: cards.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
