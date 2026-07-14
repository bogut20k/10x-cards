# Research: Spaced Repetition Libraries

Badanie przeprowadzone 2026-07-14 via `/exa-search`. Stack: TypeScript + Cloudflare Workers edge runtime.

## Wyniki

### 1. `ts-fsrs` — Rekomendowana
- **Instalacja:** `npm install ts-fsrs`
- **GitHub:** https://github.com/open-spaced-repetition/ts-fsrs (634 gwiazdek, aktywna)
- **Algorytm:** FSRS v6 (najnowszy, open-weights)
- **TypeScript:** natywny, ES modules + CommonJS + UMD
- **Edge runtime:** działa na Cloudflare Workers z `nodejs_compat` (wymaga Node.js ≥ 20 runtime; V8 Workers pokrywa to przez compat mode)
- **Licencja:** MIT
- **Wersja:** v5.3.2 (2026-03)
- **Uwagi:** Wymieniona w roadmapie (`§S-04`) jako główny kandydat. Największa społeczność spośród wszystkich opcji.

### 2. `@squeakyrobot/fsrs`
- **Instalacja:** `npm install @squeakyrobot/fsrs`
- **GitHub:** https://github.com/SqueakyRobot/fsrs
- **Algorytm:** FSRS v4.5 (z opcjonalnym v6, 17 parametrów)
- **Edge runtime:** **explicite** "Edge Runtime Ready — Cloudflare Workers, Vercel Edge, Deno Deploy"
- **Zero dependencies**, pure functions (immutable API), auto-rating z response time
- **Licencja:** MIT
- **Wersja:** v1.0.0 (Dec 2025) — 7 pobrań/tydzień
- **Wady:** bardzo nowa biblioteka, niska adopcja — ryzyko porzucenia

### 3. `quanta-fsrs`
- **Instalacja:** `npm install quanta-fsrs`
- **Algorytm:** FSRS v4.5/5
- **Edge runtime:** Cloudflare Workers ✓, zero dependencies
- Używana produkcyjnie (quanta-study.de)
- Mniejsza dokumentacja niż `ts-fsrs`

### 4. `@open-spaced-repetition/sm-2` — NIE polecana na MVP
- **Instalacja:** `npm install @open-spaced-repetition/sm-2`
- **Algorytm:** klasyczny SM-2
- **Status:** oznaczona jako **unstable** (pre-1.0), 4 gwiazdki
- Gorsze wyniki predykcji niż FSRS (~22% wyższy log-loss)

## Porównanie algorytmów

| Algorytm     | Log-loss (20M recenzji) | Poprawa vs SM-2 |
|--------------|-------------------------|-----------------|
| SM-2 (Anki)  | 0.73                    | —               |
| FSRS v4.5    | 0.36                    | ~81%            |
| FSRS v6      | 0.35                    | ~84%            |

## Decyzja do podjęcia

**Rekomendacja: `ts-fsrs` (FSRS v6)**

Jedyna kwestia do weryfikacji przed `/10x-plan`: czy `nodejs_compat` jest włączony w `wrangler.jsonc`. Jeśli nie — to pojedynczy wpis w konfiguracji.
