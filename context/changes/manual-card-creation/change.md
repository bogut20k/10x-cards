---
change_id: manual-card-creation
title: Ręczne tworzenie fiszki (przód + tył)
status: implementing
created: 2026-06-23
updated: 2026-06-23
archived_at: null
---

## Notes

S-03 z context/foundation/roadmap.md — użytkownik może ręcznie utworzyć fiszkę (przód + tył) bez użycia AI i zobaczyć ją natychmiast w swojej kolekcji.

## Stan na 2026-06-23

**Phase 1 — done** (commit `e1c522a`, `fb5eb61`):
- `src/components/flashcards/ManualCardForm.tsx` — formularz przód/tył, submit do `/api/flashcards`, inline baner sukcesu, link "Generuj z AI"
- `src/pages/dashboard.astro` — montuje island `<ManualCardForm client:only="react" />`
- Wszystkie testy manualne Phase 1 (1.3–1.7) potwierdzone

**Phase 2 — nie zaczęta** (kroki 2.1–2.7 pending):
- Brak SSR fetch fiszek z Supabase w `dashboard.astro`
- Brak props `initialCards` w `ManualCardForm`
- Brak sekcji listy fiszek z optymistycznym update
