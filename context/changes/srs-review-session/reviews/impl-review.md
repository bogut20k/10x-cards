<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Spaced Repetition Review Session (S-04)

- **Plan**: context/changes/srs-review-session/plan.md
- **Zakres**: Wszystkie fazy (1–3 z 3)
- **Data**: 2026-07-21
- **Werdykt**: ODRZUCONY
- **Ustalenia**: 2 krytyczne, 3 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | WARNING |
| Bezpieczeństwo i jakość | FAIL    |
| Architektura            | PASS    |
| Spójność wzorców        | WARNING |
| Kryteria sukcesu        | WARNING |

## Ustalenia

### F1 — IDOR oracle: POST /api/review zwraca 200 dla cudzych kart

- **Ważność**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/review/index.ts:53 i :96
- **Szczegóły**: SELECT pobiera kartę tylko po `id` bez filtra `user_id`. UPDATE też nie ma jawnego filtra `user_id`. RLS blokuje faktyczną modyfikację cudzej karty, ale serwer sprawdza `fetchError` (który nie wystąpi — RLS zwraca 0 wierszy bez błędu przy SELECT, a przy UPDATE po prostu aktualizuje 0 wierszy) i zwraca `200 { updated: true }` nawet gdy żaden wiersz nie został zmieniony. Efekt: atakujący może potwierdzić istnienie UUID cudzej karty i dostać fałszywe potwierdzenie "oceny" — brak wycieku treści, ale oracle do enumeracji i błędna semantyka HTTP.
- **Poprawka**: Dodaj `.eq("user_id", user.id)` do obu zapytań (SELECT na :53 i UPDATE na :96). Wzorzec jak w pozostałych endpointach projektu.
  - Siła: Eliminuje oracle bez żadnych kosztów wydajnościowych; czyni zabezpieczenie widocznym zamiast ukrytego w RLS.
  - Kompromis: Żaden — zmiana o zakresie 2 linii.
  - Pewność: HIGH — RLS nadal działa równolegle jako druga warstwa.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED — dodano `.eq("user_id", user.id)` do SELECT (linia 57) i UPDATE (linia 97) w index.ts

---

### F2 — Cichy sukces po błędzie HTTP w `rate()`

- **Ważność**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/flashcards/ReviewSession.tsx:109–119
- **Szczegóły**: Po sprawdzeniu `res.redirected` kod bezwarunkowo przesuwa `currentIndex++` i przechodzi do następnej karty — niezależnie od `res.status`. Gdy POST zwróci 400, 404 lub 500, użytkownik nie widzi błędu, karta "znika" z kolejki, ale wynik NIE został zapisany w DB. Sesja kończy się cichym pozornym sukcesem mimo niepowodzenia zapisu.
- **Poprawka**: Po sprawdzeniu `res.redirected`, dodaj `if (!res.ok) { const data = await res.json(); setError(data.error ?? "Błąd zapisu oceny."); return; }` przed `currentIndex++`.
  - Siła: Spójne z obsługą błędów w `useEffect` (GET session) — ten sam wzorzec `setError(...)`.
  - Kompromis: Użytkownik zobaczy ekran błędu zamiast cichego pominięcia — to pożądane zachowanie.
  - Pewność: HIGH — wzorzec już istnieje w tym samym komponencie (linia 94).
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED — dodano `if (!res.ok) { setError(...); return; }` przed `currentIndex++` w rate()

---

### F3 — Brak `isRating` guard — możliwe podwójne POST

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/flashcards/ReviewSession.tsx:99–123
- **Szczegóły**: `rate()` jest `async` i nie blokuje wielokrotnych wywołań. Szybkie kliknięcie dwóch przycisków lub wciśnięcie klawiszy `3` i `4` jednocześnie wyśle dwa POST-y — karta zostanie oceniona dwukrotnie.
- **Poprawka**: Dodaj stan `const [isRating, setIsRating] = useState(false)`, ustaw `true` przed fetch, `false` po, dodaj `disabled={isRating}` na przyciski i `if (isRating) return;` na początku `rate()`.
- **Decyzja**: FIXED — dodano isRating state + guard + disabled na przyciski + try/catch (F6 naprawione przy okazji)

---

### F4 — Niezadokumentowana zmiana `src/pages/dashboard.astro`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/pages/dashboard.astro
- **Szczegóły**: Dodano kafel "Sesja powtórek" (href="/review") i zmieniono grid na 4-kolumnowy. Zmiana jest uzasadniona i spójna z projektem, ale plan jej nie przewidywał i nie dokumentował. Przyszłe przeglądy traktują plan jako source of truth.
- **Poprawka**: Dodaj aneks do planu dokumentujący tę zmianę integracyjną (sekcja "## Aneks — zmiany integracyjne").
- **Decyzja**: FIXED — dodano aneks do plan.md

---

### F5 — Niespójny język komunikatów 401 (EN vs PL)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/api/flashcards/[id].ts:9 vs src/pages/api/review/session.ts i index.ts
- **Szczegóły**: Stary wzorzec `[id].ts` zwraca `"Unauthorized"` (EN). Nowe endpointy zwracają `"Nieautoryzowany dostęp."` (PL). Niespójność może mieć znaczenie jeśli frontend lub testy parsują treść błędu.
- **Poprawka**: Ujednolicić we wszystkich endpointach — rekomendacja: PL (spójne z resztą komunikatów w nowych plikach).
- **Decyzja**: FIXED — zmieniono "Unauthorized" na "Nieautoryzowany dostęp." w [id].ts (2 miejsca)

---

### F6 — Brak try/catch dla network errors w `rate()`

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/components/flashcards/ReviewSession.tsx:103
- **Szczegóły**: `fetch` w `rate()` nie ma `try/catch`. Błąd sieci (`TypeError: Failed to fetch`) spowoduje unhandled promise rejection. Wzorzec `try/catch → setError(...)` jest już w `useEffect` (linia 94).
- **Poprawka**: Owij `fetch` w `rate()` w `try/catch` identyczny jak w `useEffect`.
- **Decyzja**: FIXED — naprawione przy F3 (try/catch dodany do rate())

---

### F7 — Pośredni stan `redirectPath` — zbędna złożoność

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/flashcards/ReviewSession.tsx:68–72
- **Szczegóły**: `setRedirectPath("/auth/signin")` + `useEffect(() => window.location.href = redirectPath)` to okrężna droga do jednej linii. Zwiększa złożoność bez korzyści.
- **Poprawka**: Zastąp bezpośrednim `window.location.href = "/auth/signin"` w obu handlerach; usuń stan `redirectPath` i `useEffect`.
- **Decyzja**: FIXED — usunięto redirectPath state i useEffect; zastąpiono bezpośrednim window.location.href

---

### F8 — Cichy catch bez logowania w endpointach

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/review/session.ts:142, src/pages/api/review/index.ts:109
- **Szczegóły**: `catch { return 500 }` bez `console.error(e)`. W Cloudflare Workers logi są jedynym miejscem diagnostyki produkcyjnej. Wzorzec `[id].ts` też tego nie robi — luka całego projektu.
- **Poprawka**: Dodaj `console.error(e)` przed `return new Response(...)` w obu blokach catch.
- **Decyzja**: FIXED — dodano console.error(e) w catch w session.ts i index.ts

---

### F9 — Dwa DB round-tripy w session.ts (optymalizacja)

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/review/session.ts:62–83
- **Szczegóły**: Dwa osobne zapytania Supabase (due cards + next_due). W Cloudflare Workers z regionalnym Supabase każdy round-trip kosztuje latencją. Można zredukować do jednego: `LIMIT 21`, `cards = data.slice(0, 20)`, `next_due = data[20]?.due ?? null`.
- **Poprawka**: Pobierz `LIMIT 21`, weź pierwsze 20 jako karty sesji, 21. element jako `next_due`.
- **Decyzja**: SKIPPED — dwa zapytania mają różne WHERE (lte vs gt); LIMIT 21 nie zastąpi obu bez zmiany semantyki

---

### F10 — Lint broken przez untracked .cjs files (post-feature)

- **Ważność**: 👁️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: .claude/scripts/*.cjs (untracked)
- **Szczegóły**: `npm run lint` aktualnie zwraca 3 błędy dla `.claude/scripts/outlook-*.cjs`. Te pliki są untracked (nie należą do S-04). Lint przechodził w momencie commitów feature. Nie jest to regresja S-04, ale aktualny stan CI jest broken.
- **Poprawka**: Dodaj `.claude/scripts/` do `.eslintignore` lub `eslint.config` `ignores`.
- **Decyzja**: SKIPPED — .cjs files poza zakresem S-04; lint CI wymaga osobnej poprawki w eslint.config
