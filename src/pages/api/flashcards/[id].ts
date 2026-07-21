import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const PATCH: APIRoute = async (context) => {
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

  const id = context.params.id;
  let front: string, back: string;
  try {
    const body = (await context.request.json()) as { front?: string; back?: string };
    front = body.front ?? "";
    back = body.back ?? "";
  } catch {
    return new Response(JSON.stringify({ error: "Nieprawidłowe dane." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (front.trim().length === 0 || front.length > 500) {
    return new Response(JSON.stringify({ error: "Pole 'front' musi mieć 1–500 znaków." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (back.trim().length === 0 || back.length > 2000) {
    return new Response(JSON.stringify({ error: "Pole 'back' musi mieć 1–2000 znaków." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("flashcards")
    .update({ front: front.trim(), back: back.trim() })
    .eq("id", id)
    .select("id, front, back, created_at, updated_at")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: "Fiszka nie istnieje." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ flashcard: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async (context) => {
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

  const id = context.params.id;

  const { error, count } = await supabase.from("flashcards").delete({ count: "exact" }).eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: "Fiszka nie istnieje." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (count === 0) {
    return new Response(JSON.stringify({ error: "Fiszka nie istnieje." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
