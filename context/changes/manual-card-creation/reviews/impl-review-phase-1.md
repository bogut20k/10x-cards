<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Manual Card Creation

- **Plan**: context/changes/manual-card-creation/plan.md
- **Zakres**: Faza 1 z 2
- **Data**: 2026-07-02
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych · 3 ostrzeżeń · 3 obserwacje

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | WARNING |
| Dyscyplina zakresu      | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | WARNING |
| Spójność wzorców        | WARNING |
| Kryteria sukcesu        | PASS    |

## Wyniki automatyczne

- 1.1 `npm run lint` — PASS (tylko ostrzeżenia narzędzia astro-eslint-parser, brak błędów kodu)
- 1.2 `npm run build` — PASS (build Complete! 24s)

## Ustalenia

### F1 — client:only="react" zamiast client:load

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność z planem / Architektura
- **Lokalizacja**: src/pages/dashboard.astro:38
- **Szczegóły**: Plan specyfikuje `client:load` (SSR + hydratacja). Implementacja używa `client:only="react"`, które pomija SSR całkowicie. Dla autentykowanego dashboardu SEO nie ma znaczenia, ale jest to świadome odejście od specyfikacji z implikacją "flash of empty content".
- **Poprawka A ⭐ Zalecane**: Zostaw `client:only` — udokumentuj decyzję w planie jako świadomy wybór.
  - Siła: Eliminuje problem "dwóch Reactów"; dla auth dashboardu SEO nieistotne.
  - Kompromis: Flash of empty content przy wolnym połączeniu; odchylenie od `client:load`.
  - Pewność: WYSOKA — `astro.config.mjs` zawiera react dedupe, co sugeruje świadomą decyzję.
  - Martwy punkt: Czy islands w Phase 2 też będą `client:only`?
- **Poprawka B**: Zmień na `client:load`.
  - Siła: Zgodność z planem; SSR shell poprawia perceived load.
  - Kompromis: Wymaga weryfikacji react dedupe z nową konfiguracją.
  - Pewność: ŚREDNIA — nie testowano.
  - Martwy punkt: Czy `client:load` działa poprawnie z @astrojs/cloudflare + aktualną konfiguracją?
- **Decyzja**: FIXED via Fix B — zmieniono na `client:load`, build OK

### F2 — res.json() rzuca wyjątek na non-JSON błąd serwera

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/flashcards/ManualCardForm.tsx:44–47
- **Szczegóły**: W ścieżce błędu (`res.ok === false`) kod wywołuje `await res.json()` bez ochrony try/catch. Przy odpowiedzi 502/504 z HTML body `res.json()` rzuca wyjątek wpadający do catch z komunikatem "Błąd połączenia" — maskując faktyczny błąd. GenerateForm.tsx (linia 38) ma tę samą lukę.
- **Poprawka**: Owiń `res.json()` w try/catch wewnątrz gałęzi błędu, zachowując domyślny komunikat przy parse failure.
- **Decyzja**: SKIPPED

### F3 — Brak ograniczenia długości tekstu (maxLength) na textarea

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/flashcards/ManualCardForm.tsx:90–111
- **Szczegóły**: GenerateForm.tsx definiuje `MAX_CHARS = 2000` i stosuje `maxLength` na textarea (linia 123). ManualCardForm nie ma żadnego limitu — użytkownik może wysłać arbitralnie długi tekst. API nie waliduje długości; błąd pojawi się dopiero w warstwie DB.
- **Poprawka**: Dodaj stałe `MAX_FRONT_CHARS` / `MAX_BACK_CHARS` i `maxLength` na obu textarea, wzorując się na GenerateForm.tsx.
- **Decyzja**: FIXED — dodano MAX_FRONT_CHARS=500 / MAX_BACK_CHARS=2000 i maxLength na oba textarea

### F4 — Nieplanowany user-info card w dashboard

- **Ważność**: OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/pages/dashboard.astro:21–36
- **Szczegóły**: Plan Phase 1 nie wymienia karty z emailem użytkownika i przyciskiem sign-out. Implementacja dodała panel informacyjny powyżej ManualCardForm. Logiczny EXTRA, bez ryzyka bezpieczeństwa.
- **Poprawka**: Zaakceptuj — uzasadniony EXTRA. Opcjonalnie zaktualizuj plan.
- **Decyzja**: ACCEPTED — zaakceptowany EXTRA; notatka dopisana do plan.md

### F5 — Label przycisku "Zapisuję..." zamiast "Zapisz fiszkę" podczas ładowania

- **Ważność**: OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/components/flashcards/ManualCardForm.tsx:124–126
- **Szczegóły**: Plan: spinner przy `isLoading`, label zostaje "Zapisz fiszkę". Implementacja: label zmienia się na "Zapisuję..." obok spinnera. UX-owo lepsze niż specyfikacja — celowe odchylenie.
- **Poprawka**: Pomiń — celowe ulepszenie, nie regresja.
- **Decyzja**: FIXED — przywrócono label "Zapisz fiszkę" zgodnie z planem

### F6 — vite.optimizeDeps.exclude: ["openai"] w astro.config.mjs

- **Ważność**: OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: astro.config.mjs:20–22
- **Szczegóły**: Commit Phase 1 zawiera fix Vite dla pakietu `openai` niezwiązany z ManualCardForm — wyciek preparatywnej zmiany z ai-generation-and-review. Bezpieczny i potrzebny dla buildu, ale logicznie należy do innego PR.
- **Poprawka**: Zaakceptuj w obecnym stanie. Pilnuj czystości granic przy kolejnych PR-ach.
- **Decyzja**: SKIPPED — zmiana bezpieczna i potrzebna
