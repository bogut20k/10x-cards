---
project: "10xCards"
updated: 2026-07-14
source: roadmap.md v1
---

# GitHub Issues — 10xCards

Mapowanie roadmapowych Change ID na GitHub Issues. Aktualizuj status po zamknięciu issue.

## Status legend

| Symbol | Znaczenie        |
| ------ | ---------------- |
| ✅      | closed / done    |
| 🔄      | in progress      |
| 📋      | open / proposed  |
| 🚫      | blocked          |

---

## Foundations

| # | Change ID                | Tytuł issue                                 | Status | Uwagi                        |
| - | ------------------------ | ------------------------------------------- | ------ | ---------------------------- |
| — | gate-product-routes      | Ochrona tras produktowych w middleware       | ✅      | F-00 done                    |
| — | flashcard-schema-and-rls | Schemat danych fiszek i RLS w Supabase      | ✅      | F-01 done                    |

## Slices

| # | Change ID                 | Tytuł issue                                          | Status | Uwagi                                       |
| - | ------------------------- | ---------------------------------------------------- | ------ | ------------------------------------------- |
| — | ai-generation-and-review  | Generowanie fiszek przez AI + przegląd przed zapisem | ✅      | S-01 done                                   |
| — | flashcard-edit-and-delete | Edycja i usuwanie zapisanych fiszek                  | ✅      | S-02 done                                   |
| — | manual-card-creation      | Ręczne tworzenie fiszki (przód + tył)                | ✅      | S-03 done                                   |
| — | srs-review-session        | Sesja powtórek (algorytm spaced repetition)          | 🔄      | S-04; open; wymaga S-01; biblioteka SR do wyboru  |

## Następny krok

Otworzyć issue dla **S-04 `spaced-repetition-session`** i uruchomić `/10x-plan spaced-repetition-session`.
