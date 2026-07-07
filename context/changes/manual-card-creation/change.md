---
change_id: manual-card-creation
title: Ręczne tworzenie fiszki (przód + tył)
status: done
created: 2026-06-23
updated: 2026-07-07
archived_at: null
---

## Notes

S-03 z context/foundation/roadmap.md — użytkownik może ręcznie utworzyć fiszkę (przód + tył) bez użycia AI i zobaczyć ją natychmiast w swojej kolekcji.

## Stan na 2026-07-07 — DONE

**Phase 1 — done** (commit `e1c522a`, `fb5eb61`):

- `src/components/flashcards/ManualCardForm.tsx` — formularz przód/tył, submit do `/api/flashcards`, inline baner sukcesu, link "Generuj z AI"
- Wszystkie testy manualne Phase 1 (1.3–1.7) potwierdzone

**Phase 2 — pominięta (redundantna)**:

- `/flashcards` (S-02) już zawiera pełną listę fiszek z edycją i usuwaniem
- Topbar "Moje fiszki" linkuje do tej listy ze wszystkich stron
- Dodawanie listy do dashboardu byłoby duplikacją

**Dodatkowe zmiany (commit `554103e`, `071e272`, `6983265`, `ca3263f`):**

- `ManualCardForm` przeniesiony z `dashboard.astro` na dedykowaną stronę `src/pages/flashcards/new.astro`
- `dashboard.astro` przebudowany jako strona przeglądowa (powitanie, statystyki, skróty)
- Topbar przeprojektowany: widoczny na wszystkich stronach non-auth, liczba fiszek jako superscript, Sign in/out po prawej
- `Welcome.astro`: ukryte CTA auth dla zalogowanych użytkowników
- Pełny flow reset hasła: `src/pages/auth/forgot-password.astro`, `src/pages/auth/reset-password.astro`, `src/pages/api/auth/forgot-password.ts`, `src/pages/api/auth/reset-password.ts`
- Supabase redirect URLs skonfigurowane (`/auth/reset-password` na allowlist)
