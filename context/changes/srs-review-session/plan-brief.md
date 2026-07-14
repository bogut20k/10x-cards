# Sesja powtórek SR (S-04) — Krótki plan

> Pełny plan: `context/changes/srs-review-session/plan.md`
> Badania: `context/changes/srs-review-session/research.md`, `research-sr-libraries.md`, `ts-fsrs-api-docs.md`

## Co i dlaczego

Implementacja sesji powtórek FSRS v6 (biblioteka `ts-fsrs`) kończąca north-star pętlę produktu: wkleij tekst → AI generuje fiszki → zaakceptuj → ucz się. Bez sesji powtórek hipoteza produktu nie jest zweryfikowana.

## Punkt wyjścia

Baza kodu ma kompletny schemat FSRS w DB (`supabase/migrations/20260618000000_flashcard_schema.sql`) poza jedną brakującą kolumną (`learning_steps`). Trasa `/review` jest już chroniona w middleware. Brak endpointów review i strony UI. `ts-fsrs` nie jest zainstalowana.

## Pożądany stan końcowy

Zalogowany użytkownik wchodzi na `/review`, widzi kolejkę max 20 fiszek należnych dziś, przegląda je flip-by-flip (klik lub Spacja), ocenia każdą na skali Again/Hard/Good/Easy z podglądem interwału przy każdym przycisku, a algorytm FSRS wyznacza nowy termin powtórki. Po ostatniej karcie widzi "Gotowe na dziś! Wróć za X h".

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Biblioteka SR | `ts-fsrs` (FSRS v6) | Największa adopcja, MIT, działa na CF Workers z nodejs_compat | Badania |
| Limit sesji | Max 20 kart | Przewidywalny czas sesji (~10 min), standard Anki | Plan |
| Rating UX | 4 przyciski (Again/Hard/Good/Easy) | Pełna granulacja FSRS — lepsze dane dla algorytmu | Plan |
| Flip | Klik/Spacja → odsłoń tył → ocena | Wymusza active recall — core mechanizm SR | Plan |
| Preview interwałów | Tak, server-side `repeat()` | Transparentny feedback dla użytkownika bez bundlowania ts-fsrs na kliencie | Plan |
| `elapsed_days` w DB | Zostaw bez zmian | Deprecated, DEFAULT 0, nie koliduje; jedna migracja mniej | Plan |
| Empty state | "Gotowe na dziś" + czas powrotu | Motywujący feedback zamiast gołego komunikatu | Plan |

## Zakres

**W zakresie:**
- Migracja: ADD COLUMN `learning_steps`
- `npm install ts-fsrs`
- GET `/api/review/session` — 20 kart due + preview interwałów
- POST `/api/review` — zapis oceny + UPDATE FSRS state
- Strona `/review` + React island `ReviewSession.tsx`
- Skróty klawiszowe (Spacja=flip, 1-4=ocena)

**Poza zakresem:**
- Rollback ostatniej oceny
- Historia powtórek (review_log)
- Własne parametry FSRS
- Konfigurowalny limit sesji przez UI
- Mobilne gesty swipe

## Architektura / Podejście

```
GET /api/review/session
  → SELECT 20 kart WHERE due ≤ now ORDER BY due
  → per karta: TypeConvert.card() → repeat() → formatInterval
  → { cards: FlashcardForReview[], next_due: string | null }

/review (Astro) → ReviewSession.tsx (React island, client:load)
  phase: loading → front → back → done
  flip: klik/Spacja
  ocena: klik przycisku lub 1-4 → POST /api/review

POST /api/review
  → { card_id, rating } → SELECT karta z DB
  → TypeConvert.card() → scheduler.next() → UPDATE flashcards
```

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Foundation | Migracja learning_steps + ts-fsrs + typy TS | Migracja przez MCP (AVG może blokować db push) |
| 2. Backend API | GET session + POST review — endpointy gotowe | TypeConvert.card() + formatInterval — nieoczywiste API |
| 3. Frontend | /review strona + ReviewSession.tsx — kompletny UX | Stan sesji (kolejka kart) + obsługa klawiatury |

**Wymagania wstępne:** F-01 i S-01 done (spełnione); Supabase MCP dostępne (project ref: `uebytioeeilxnsurhrwg`)  
**Szacowany nakład pracy:** ~2-3 sesje w 3 fazach

## Otwarte ryzyka i założenia

- `elapsed_days` wymagany przez `TypeConvert.card()` nawet jako 0 — pominięcie spowoduje błąd TypeScript
- Nowe fiszki mają `due = NOW()` (DEFAULT w DB) — będą w sesji od razu po dodaniu
- `repeat()` oblicza preview w momencie GET session — przy sesji trwającej >1h preview dla ostatnich kart może minimalnie odbiegać od aktualnego

## Kryteria sukcesu (podsumowanie)

- Użytkownik może przejść przez sesję od pierwszej karty do ekranu "Gotowe na dziś!" bez błędów
- Pola FSRS (`due`, `stability`, `reps`, `state`) zmieniają się w DB po każdej ocenie
- Preview interwałów na przyciskach jest spójny z tym co ts-fsrs oblicza dla danej oceny
