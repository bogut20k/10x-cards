---
date: 2026-07-14T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: ea47cecd1a4e85bb59c8f858d59b8080a9627d60
branch: master
repository: 10xCards
topic: "Zgodność ts-fsrs z bazą kodu — implementacja S-04 (srs-review-session)"
tags: [research, codebase, ts-fsrs, srs, flashcards, supabase, cloudflare-workers]
status: complete
last_updated: 2026-07-14
last_updated_by: Claude Sonnet 4.6
---

# Research: Zgodność ts-fsrs z bazą kodu — S-04

**Date**: 2026-07-14  
**Git Commit**: ea47cecd1a4e85bb59c8f858d59b8080a9627d60  
**Branch**: master

## Research Question

Czy biblioteka `ts-fsrs` (udokumentowana w `ts-fsrs-api-docs.md`) jest zgodna z istniejącą bazą kodu? Co trzeba zrobić, żeby zaimplementować S-04?

## Summary

**Wynik: prawie w pełni zgodna — 3 luki do zamknięcia przed implementacją.**

Środowisko runtime (Cloudflare Workers + `nodejs_compat`) jest gotowe. Schemat DB pokrywa 8 z 9 pól `Card` interface — brakuje tylko kolumny `learning_steps`. Typ `Flashcard` w `types.ts` i SELECT w GET endpoint nie zawierają pól SR. Biblioteka `ts-fsrs` nie jest jeszcze zainstalowana.

## Detailed Findings

### 1. Runtime — ✅ W pełni zgodny

- `nodejs_compat` jest już w `compatibility_flags` w `wrangler.jsonc` — wymagane dla ts-fsrs na Workers
- Node 22.14.0 (`.nvmrc`) — nowszy niż wymagane minimum (≥20)
- `compatibility_date`: 2026-05-08

Plik: `wrangler.jsonc` — `compatibility_flags: ["nodejs_compat", "disable_nodejs_process_v2"]`

### 2. Schemat DB — ✅ Prawie w pełni zgodny (1 brakująca kolumna)

Migracja: `supabase/migrations/20260618000000_flashcard_schema.sql`

| Pole ts-fsrs `Card` | Kolumna DB | Typ DB | Status |
|---|---|---|---|
| `due` | `due` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | ✅ |
| `stability` | `stability` | `FLOAT NOT NULL DEFAULT 0` | ✅ |
| `difficulty` | `difficulty` | `FLOAT NOT NULL DEFAULT 0` | ✅ |
| `scheduled_days` | `scheduled_days` | `INTEGER NOT NULL DEFAULT 0` | ✅ |
| `learning_steps` | ❌ brak | — | **MISSING** |
| `reps` | `reps` | `INTEGER NOT NULL DEFAULT 0` | ✅ |
| `lapses` | `lapses` | `INTEGER NOT NULL DEFAULT 0` | ✅ |
| `state` | `state` | `SMALLINT NOT NULL DEFAULT 0` | ✅ |
| `last_review` | `last_review` | `TIMESTAMPTZ` (nullable) | ✅ |

**Bonus w DB (nie w Card):** `elapsed_days INTEGER NOT NULL DEFAULT 0` — deprecated w ts-fsrs, ale obecny w DB; można ignorować lub usunąć.

**Indeksy:** `(user_id)` + `(user_id, due)` — ten drugi bezpośrednio wspiera query "karty należne dziś".

### 3. Typ Flashcard w TypeScript — ⚠️ Niekompletny

`src/types.ts` — `Flashcard` interface zawiera tylko: `id, user_id, front, back, created_at, updated_at`. Brak wszystkich pól SR.

Przed implementacją S-04 trzeba rozszerzyć typ o pola SR lub stworzyć osobny `FlashcardWithSR`.

### 4. GET /api/flashcards — ⚠️ Nie selectuje pól SR

`src/pages/api/flashcards/index.ts` (linia ~22-25):
```typescript
.select("id, front, back, created_at, updated_at")
.order("created_at", { ascending: false })
```

Endpoint do sesji powtórek będzie potrzebował osobnego SELECT z polami SR + filtr `due <= now()`.

### 5. Wzorzec endpointów — ✅ Gotowy do powtórzenia

Istniejące endpointy w `src/pages/api/flashcards/` pokazują spójny wzorzec:
- Autoryzacja: `const { user } = context.locals` → 401 jeśli brak
- Supabase client: `createServerClient` z `@supabase/ssr` z cookies
- RLS: baza danych filtruje per user — kod nie dodaje `.eq("user_id", user.id)` w SELECT
- Odpowiedzi: `{ error: "..." }` po polsku / `{ flashcard: {...} }` przy sukcesie
- HTTP status: 200/201/204/400/401/404/500

Plik referencyjny: `src/pages/api/flashcards/[id].ts`

### 6. ts-fsrs — ❌ Nie zainstalowana

`package.json` — brak `ts-fsrs` w dependencies. Trzeba: `npm install ts-fsrs`

## Code References

- `supabase/migrations/20260618000000_flashcard_schema.sql` — schemat flashcards z polami FSRS
- `src/types.ts:1-11` — Flashcard interface (bez SR fields)
- `src/pages/api/flashcards/index.ts:22-25` — SELECT bez SR fields
- `src/pages/api/flashcards/[id].ts` — wzorzec PATCH/DELETE do naśladowania
- `src/lib/supabase.ts` — createServerClient setup
- `src/middleware.ts` — user injection do context.locals
- `wrangler.jsonc` — nodejs_compat flag

## Architecture Insights

- RLS w Supabase zastępuje per-query user filtering w kodzie — zgodnie z istniejącym wzorcem nowy endpoint `/api/review` też może opierać się na RLS.
- ts-fsrs jest czysto obliczeniowa (pure functions) — zero side-effectów, brak sieci, brak state — idealna dla edge runtime.
- Flow S-04: `GET /api/review/session` (karty due) → UI pokazuje kartę → `POST /api/review` (ocena + scheduler.next()) → Supabase UPDATE.

## Luki do zamknięcia przed /10x-plan (lub w planie)

| # | Luka | Akcja | Ryzyko |
|---|---|---|---|
| 1 | Brak kolumny `learning_steps` w DB | Nowa migracja Supabase: `ALTER TABLE flashcards ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0` | Niskie — additive change, bez breaking |
| 2 | `ts-fsrs` nie zainstalowana | `npm install ts-fsrs` | Brak |
| 3 | `Flashcard` type bez pól SR | Rozszerzyć `src/types.ts` o pola SR lub dodać `FlashcardSRState` type | Niskie |

## Open Questions

1. Czy `elapsed_days` w schemacie DB (deprecated w ts-fsrs) ma być zachowany czy usunięty nową migracją?
2. Czy sesja powtórek ma mieć limit kart (np. max 20/sesję) czy wszystkie due naraz?
3. Czy `repeat()` (podgląd interwałów per ocena, UX jak Anki) ma być zaimplementowany w MVP?

## Related Research

- `context/changes/srs-review-session/research-sr-libraries.md` — wybór biblioteki SR (ts-fsrs rekomendowana)
- `context/changes/srs-review-session/ts-fsrs-api-docs.md` — pełne API docs ts-fsrs z Context7
