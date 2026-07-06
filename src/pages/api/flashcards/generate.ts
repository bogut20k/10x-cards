import type { APIRoute } from "astro";
import { generateFlashcards } from "@/lib/services/ai-provider";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async (context) => {
  let text: string;
  try {
    const body = (await context.request.json()) as { text?: unknown };
    const rawText = body.text;
    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return json({ error: "Text is required." }, 400);
    }
    if (rawText.length > 2000) {
      return json({ error: "Text must be at most 2000 characters." }, 400);
    }
    text = rawText;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  try {
    const cards = await generateFlashcards(text);
    return json({ cards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not configured")) {
      return json({ error: "AI service is not configured." }, 500);
    }
    return json({ error: "Generowanie nie powiodło się. Spróbuj ponownie." }, 500);
  }
};
