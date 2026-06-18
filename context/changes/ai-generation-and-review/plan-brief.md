# AI Flashcard Generation and Review — Plan Brief

> Full plan: `context/changes/ai-generation-and-review/plan.md`

## What & Why

Budujemy S-01 — pierwszą pionową funkcję produktową: użytkownik wkleja tekst, Claude Haiku generuje 3–20 fiszek, użytkownik przegląda i edytuje je inline, a następnie zapisuje do swojej kolekcji. To rdzeń hipotezy produktowej — bez tego flow 10xCards nie istnieje jako produkt.

## Starting Point

Middleware (F-00) chroni już `/generate` i `/api/*`. Brak tabeli `flashcards` w Supabase (czeka na F-01), brak SDK Anthropic w projekcie, brak `src/types.ts`. Wzorzec React island i API endpoint jest ustalony na podstawie kodu auth.

## Desired End State

Zalogowany użytkownik wchodzi na `/generate`, wkleja tekst (max 2000 znaków), klika "Generuj", widzi spinner a potem listę fiszek z banerem ostrzegawczym AI. Może edytować fiszki inline lub je usunąć, następnie klika "Zapisz wszystkie" — fiszki trafiają do Supabase, strona przekierowuje na `/dashboard` z komunikatem "Zapisano N fiszek!".

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| AI provider | Anthropic Claude | Znany SDK w tym środowisku; dobra jakość strukturyzowanego tekstu |
| Model | claude-haiku-4-5-20251001 | Szybki i tani — NFR ≤10s łatwy do spełnienia |
| UX flow | Jedna strona /generate | Prostszy state management; brak redirect między stronami |
| Generowanie | Wait for all, pokaż naraz | Prostszy kod; brak SSE na Workers; NFR i tak spełniony |
| Edycja | Inline (klik w kartę) | Zero dodatkowych kliknięć; naturalny flow przed zapisem |
| Akceptacja | Zapisz wszystkie + X per karta | PRD: 75% akceptowanych bez edycji — szybki happy path |
| Limit tekstu | 2000 znaków, AI decyduje 3–20 kart | Zgodne z NFR ≤10s; walidacja po stronie klienta i serwera |
| Błąd AI | Error na stronie, formularz zostaje | Użytkownik nie traci tekstu, może spróbować ponownie |
| Ostrzeżenie AI | Dismissible banner nad listą | Spełnia guardrail z PRD, nienatarczywy |
| Po zapisie | Redirect /dashboard z ?saved=N | Naturalne zakończenie flow |

## Scope

**In scope:**
- `npm install @anthropic-ai/sdk`
- `src/types.ts` — FlashcardDraft, Flashcard
- `astro.config.mjs` — ANTHROPIC_API_KEY w env schema
- `src/pages/api/flashcards/generate.ts` — POST, wywołuje Claude
- `src/pages/generate.astro` — page shell
- `src/components/flashcards/GenerateForm.tsx` — React island (formularz + review + zapis)
- `src/pages/api/flashcards/index.ts` — POST, bulk insert do Supabase (wymaga F-01)
- `src/pages/dashboard.astro` — success banner po zapisie

**Out of scope:**
- Streaming (SSE/chunked)
- Per-card checkboxy
- Auto-retry
- Separate /review page
- Tekst > 2000 znaków
- Decks/kolekcje
- Edycja/usuwanie zapisanych fiszek (to S-04)

## Architecture / Approach

```
/generate (generate.astro)
  └── GenerateForm (client:load React island)
        ├── textarea + char counter + Generuj button
        ├── POST /api/flashcards/generate → Claude Haiku → JSON [{front,back}]
        ├── Loader / error display
        └── Card review section (gdy cards !== null)
              ├── AI warning banner (dismissible)
              ├── Card list (inline edit + delete per card)
              └── Zapisz wszystkie → POST /api/flashcards → window.location /dashboard?saved=N

/api/flashcards/generate.ts  →  Anthropic SDK  →  Claude Haiku
/api/flashcards/index.ts     →  Supabase  →  flashcards table (requires F-01)
/dashboard.astro             →  reads ?saved param  →  success banner
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. AI Generation Endpoint | SDK + env + types + `/api/flashcards/generate` | Claude response nie jest validnym JSON — obsłużone przez try/catch |
| 2. Generate Page + Form UI | `/generate` page + formularz z loaderem i error state | Styling spójny z istniejącym design systemem |
| 3. Review UI + Save | Karty inline edit/delete + `/api/flashcards` + dashboard banner | Zablokowane przez F-01 (tabela flashcards musi istnieć) |

**Prerequisites:** F-00 done ✓ (middleware). F-01 must be complete before Phase 3.
**Estimated effort:** ~2 sesje; Faza 1+2 niezależne od F-01, Faza 3 czeka na F-01.

## Open Risks & Assumptions

- Claude Haiku może zwrócić nie-JSON mimo instrukcji systemowej — endpoint obsługuje try/catch → 500
- NFR ≤10s przy 2000 znakach zakładamy spełnione przez Haiku; jeśli nie — fallback do krótszego limitu
- Kolumny w tabeli `flashcards` (F-01) muszą być: `id`, `user_id`, `front`, `back` — plan zakłada te nazwy

## Success Criteria (Summary)

- Użytkownik może wkleić tekst i otrzymać fiszki od AI w ≤10s
- Może edytować/usuwać fiszki inline przed zapisem
- Po zapisie fiszki pojawiają się w tabeli `flashcards` w Supabase z poprawnym `user_id`
