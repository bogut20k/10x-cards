import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ANTHROPIC_API_KEY, OPENROUTER_API_KEY, AI_PROVIDER, OPENROUTER_MODEL } from "astro:env/server";
import type { FlashcardDraft } from "@/types";

const SYSTEM_PROMPT = `You are a flashcard generator. Given a study text, create 3 to 20 flashcard question-answer pairs that help the reader memorize the key concepts.

IMPORTANT: Always respond in the same language as the input text.

Return ONLY a valid JSON array. No markdown, no prose, no explanation — just the JSON array.
Each element must be an object with exactly two string fields: "front" (the question) and "back" (the answer).

Example output (Polish input → Polish output):
[{"front": "Co to jest fotosynteza?", "back": "Proces przekształcania CO2 i wody w glukozę przy udziale światła słonecznego."}]`;

export async function generateFlashcards(text: string): Promise<FlashcardDraft[]> {
  const provider = AI_PROVIDER ?? "anthropic";

  if (provider === "openrouter") {
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured.");

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY,
    });

    const models = (OPENROUTER_MODEL ?? "google/gemini-2.0-flash-exp:free")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    let lastError: Error = new Error("No models configured.");
    for (const model of models) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: 2048,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from OpenRouter.");
        return parseCards(content);
      } catch (err) {
        // Auth errors (401/403) are permanent — stop immediately.
        // All other API errors (404 model gone, 429 rate limit, 5xx, etc.) — try next model.
        if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }
    throw lastError;
  }

  // default: anthropic
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const firstBlock = message.content[0] as Anthropic.ContentBlock | undefined;
  if (firstBlock?.type !== "text") throw new Error("Unexpected Anthropic response format.");
  return parseCards(firstBlock.text);
}

function parseCards(raw: string): FlashcardDraft[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned no flashcards.");
  }
  return parsed as FlashcardDraft[];
}
