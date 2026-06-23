import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "astro:env/server";
import type { FlashcardDraft } from "@/types";

const SYSTEM_PROMPT = `You are a flashcard generator. Given a study text, create 3 to 20 flashcard question-answer pairs that help the reader memorize the key concepts.

Return ONLY a valid JSON array. No markdown, no prose, no explanation — just the JSON array.
Each element must be an object with exactly two string fields: "front" (the question) and "back" (the answer).

Example output:
[{"front": "What is photosynthesis?", "back": "The process by which plants convert sunlight, water, and CO2 into glucose and oxygen."}]`;

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

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "AI service is not configured." }, 500);
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const firstBlock = message.content[0] as Anthropic.ContentBlock | undefined;
    if (firstBlock?.type !== "text") {
      return json({ error: "Unexpected AI response format." }, 500);
    }

    let cards: FlashcardDraft[];
    try {
      const parsed: unknown = JSON.parse(firstBlock.text);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return json({ error: "AI returned no flashcards. Please try again." }, 500);
      }
      cards = parsed as FlashcardDraft[];
    } catch {
      return json({ error: "AI returned invalid JSON. Please try again." }, 500);
    }

    return json({ cards });
  } catch {
    return json({ error: "Generowanie nie powiodło się. Spróbuj ponownie." }, 500);
  }
};
