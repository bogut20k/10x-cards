# Manual Card Creation — Plan Brief

> Full plan: `context/changes/manual-card-creation/plan.md`

## What & Why

S-03: użytkownik może ręcznie utworzyć fiszkę (przód + tył) bez AI i zobaczyć ją natychmiast w kolekcji. Dashboard staje się centrum — formularz tworzenia + lista fiszek + nawigacja do generowania AI.

## Starting Point

Dashboard istnieje (`src/pages/dashboard.astro`) z success bannerem dla `?saved=N`. Endpoint `POST /api/flashcards` (z S-01 Phase 3) już obsługuje zapis fiszek. Brak formularza ręcznego tworzenia i listy kolekcji.

## Desired End State

Na `/dashboard`: formularz z polami Przód i Tył → zapis → inline baner sukcesu + nowa fiszka dokładana na listę bez przeładowania. Lista fiszek użytkownika renderowana pod formularzem (SSR + optymistyczny update). Link "Generuj z AI" prowadzi do /generate.

## Key Decisions Made

| Decision | Choice | Why |
|---|---|---|
| Lokalizacja formularza | Dashboard (/dashboard) | Jedno centrum akcji zamiast osobnej strony |
| Po zapisie | Inline baner + clear form | Płynniejszy UX przy tworzeniu wielu fiszek |
| Lista kart | Tak — SSR + optymistyczny update | Spełnia "zobaczyć natychmiast w kolekcji" |
| Nawigacja AI | Link "Generuj z AI" | Odkrywalność funkcji AI |
| Podział faz | Dwie fazy | Testowalna jednostkowo forma (Phase 1) przed listą (Phase 2) |

## Scope

**In scope:** Formularz ręcznego tworzenia (front+back), zapis do DB, inline sukces, lista kolekcji, link do /generate

**Out of scope:** Edycja i usuwanie fiszek (S-04), paginacja listy, filtrowanie, stan spaced repetition, walidacja duplikatów

## Architecture / Approach

Nowy React island `ManualCardForm` montowany na dashboardzie z `client:load`. Phase 1: sam formularz bez listy. Phase 2: SSR query w Astro frontmatter (Supabase), przekazanie `initialCards` jako props; island zarządza listą lokalnie i prependuje nową kartę po zapisie (optymistyczny update z tymczasowym `crypto.randomUUID()` jako id).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. ManualCardForm Island | Formularz + submit + inline sukces + link AI | Spójność stylów z istniejącym UI |
| 2. Dashboard Enhancement | SSR lista kart + live update po zapisie | Supabase query w Astro frontmatter |

**Prerequisites:** F-01 (done ✓), `POST /api/flashcards` endpoint (done ✓, S-01 Phase 3)
**Estimated effort:** ~1 sesja, 2 fazy

## Open Risks & Assumptions

- Optymistyczny update używa tymczasowego `id` — po odświeżeniu lista pobierana z DB (poprawne id)
- `createClient` może zwrócić `null` jeśli brak env — handled: `data: []` jako fallback

## Success Criteria (Summary)

- Użytkownik tworzy fiszkę na dashboardzie i widzi ją natychmiast na liście
- Fiszka jest persisted w Supabase po odświeżeniu strony
- Link "Generuj z AI" działa i prowadzi do /generate
