# Flashcard Edit and Delete — Krótki plan

> Pełny plan: `context/changes/flashcard-edit-and-delete/plan.md`

## Co i dlaczego

Budujemy stronę `/flashcards` gdzie użytkownik może przeglądać, edytować i usuwać swoje zapisane fiszki. S-02 domyka zarządzanie kolekcją — bez tej funkcji użytkownik nie ma możliwości poprawienia błędnej fiszki ani wyczyszczenia kolekcji.

## Punkt wyjścia

Tabela `flashcards` istnieje (F-01), fiszki można zapisywać (S-01, S-03). Brakuje: endpointu GET/PATCH/DELETE, strony `/flashcards` i globalnego nav baru. Dashboard nie wyświetla listy fiszek — tylko formularz tworzenia.

## Pożądany stan końcowy

Użytkownik wchodzi na `/flashcards` (dostępne z globalnego nav baru), widzi swoje fiszki z sortowaniem (Najnowsze / Najstarsze / A-Z), może kliknąć fiszkę żeby edytować ją inline, może usunąć z możliwością cofnięcia w ciągu 5 sekund.

## Kluczowe podjęte decyzje

| Decyzja        | Wybór                          | Dlaczego (1 zdanie)                                   | Źródło |
| -------------- | ------------------------------ | ----------------------------------------------------- | ------ |
| Gdzie lista    | Dedykowana `/flashcards`       | Czyste rozdzielenie odpowiedzialności + baza dla S-04 | Plan   |
| Undo delete    | Optimistic UI, DELETE po 5s    | Brak zmian schematu DB; wystarczające dla MVP         | Plan   |
| Edit UX        | Inline edit (jak GenerateForm) | Użytkownik zna wzorzec z przeglądu AI                 | Plan   |
| Sortowanie     | User-selectable (3 opcje)      | Flexibilność bez komplikowania API                    | Plan   |
| Paginacja      | Brak (load all)                | MVP zakłada dziesiątki kart                           | Plan   |
| Nav bar        | Globalny w Layout.astro        | Dostępny z każdego miejsca w aplikacji                | Plan   |
| Char limits    | Front 500 / Back 2000          | Spójność z ManualCardForm                             | Plan   |
| Error handling | Toast + rollback UI            | Użytkownik nie traci danych przy błędzie API          | Plan   |

## Zakres

**W zakresie:**

- GET/PATCH/DELETE endpointy dla fiszek
- Strona `/flashcards` z listą i sortowaniem
- Inline edit z walidacją znaków
- Delete z optimistic Undo (5s timer)
- Toast powiadomienia (sukces + błąd)
- Global nav bar w Layout.astro
- Empty state z linkami do tworzenia

**Poza zakresem:**

- Paginacja / infinite scroll
- Wyszukiwanie i filtrowanie tekstu
- Bulk delete / bulk edit
- Soft delete w DB
- Mobilny hamburger menu

## Architektura / Podejście

Nowy endpoint `[id].ts` obok istniejącego `index.ts` (Astro dynamic route). React island `FlashcardList.tsx` zarządza całym stanem: fetch przy mount, sort client-side, optimistic updates przy edit/delete. Layout.astro warunkowo renderuje nav bar gdy `Astro.locals.user` jest truthy — bez dodatkowych propsów.

## Fazy w skrócie

| Faza                    | Co dostarcza                      | Kluczowe ryzyko                              |
| ----------------------- | --------------------------------- | -------------------------------------------- |
| 1. API endpoints        | GET list + PATCH/DELETE per-karta | RLS musi blokować cudze fiszki (test 1.9)    |
| 2. FlashcardList island | Pełny UI listy z edit/delete/undo | Timer Undo + concurrent edit edge cases      |
| 3. Global nav bar       | Shared nav we wszystkich stronach | Layout.astro dotyka każdej strony — regresja |

**Wymagania wstępne:** F-01 (tabela flashcards) ✓, S-01 (zapis fiszek) ✓  
**Szacowany nakład pracy:** ~2-3 sesje implementacyjne, 3 fazy

## Otwarte ryzyka i założenia

- Undo timer 5s — jeśli użytkownik zamknie kartę podczas odliczania, DELETE nie zostanie wysłany (akceptowalne dla MVP)
- Nav bar bez aktywnego stanu linku (opcjonalne dla MVP)
- Edycja jednej karty wyklucza edycję innej jednocześnie (single `editingId`)

## Kryteria sukcesu (podsumowanie)

- Użytkownik może edytować i zapisać fiszkę bez przeładowania strony
- Usunięta fiszka daje 5s na cofnięcie; po tym czasie znika trwale
- Globalny nav bar zastępuje duplikat UI z dashboardu
