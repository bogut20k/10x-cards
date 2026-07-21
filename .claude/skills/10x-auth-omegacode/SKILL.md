---
name: 10x-auth-omegacode
description: >
  Automatyzuje logowanie do 10x-cli przez magic link. Uruchamia równolegle
  `10x auth --email rk@omegacode.pl` oraz skrypt Playwright który czyta Outlooka
  przez outlook.office.com, wykrywa nowy mail od noreply@notifications.przeprogramowani.pl,
  klika link, przenosi mail do kosza i zamyka Chrome.
  Sesja Chrome jest zapisana — pierwsze uruchomienie wymaga ręcznego logowania 2FA.
  Trigger phrases: "zaloguj 10x", "10x auth", "auth 10x", "zaloguj się do 10x",
  "odśwież token 10x", "10x login".
allowed-tools:
  - PowerShell
  - Bash
---

# 10x Auth — automatyczne logowanie przez magic link (Playwright)

Skill uruchamia dwa procesy równolegle:
1. `10x auth --email rk@omegacode.pl` — wysyła żądanie magic linka
2. `outlook-magic-link.cjs` — Playwright otwiera Outlook w Chrome, szuka nowego maila od `noreply@notifications.przeprogramowani.pl`, klika link, przenosi mail do kosza, zamyka Chrome

## Workflow

### Krok 0 — Ustal email

Jeśli użytkownik podał email jako argument (np. `/10x-auth-omegacode inny@email.com`), użyj go.
W przeciwnym razie użyj domyślnego: `rk@omegacode.pl`.

Dalej w tym skilla `<EMAIL>` oznacza ustalony email.

### Krok 1 — Poinformuj użytkownika

> Wysyłam magic link na **<EMAIL>** i uruchamiam Outlook — poczekaj do 3 minut.

### Krok 2 — Sprawdź czy skrypt Playwright istnieje

```powershell
Test-Path "C:\Users\Radoslaw\.claude\.global\10x-auth-omegacode\outlook-magic-link.cjs"
```

Jeśli `False` — STOP:
```
Skrypt outlook-magic-link.cjs nie istnieje w C:\Users\Radoslaw\.claude\.global\10x-auth-omegacode\.
```

### Krok 3 — Uruchom oba procesy równolegle

**Playwright (czyta Outlooka i klika link):**
```powershell
Start-Process powershell -WindowStyle Minimized -ArgumentList "-Command", "node 'C:\Users\Radoslaw\.claude\.global\10x-auth-omegacode\outlook-magic-link.cjs'"
```

**Magic link (wyślij żądanie — użyj <EMAIL>):**
```powershell
$env:NODE_OPTIONS="--use-system-ca"; 10x auth --email <EMAIL>
```

Uruchom oba — nie czekaj aż jeden skończy.

### Krok 4 — Monitoruj wynik

Sprawdzaj output `10x auth` co kilka sekund. Sukces gdy zwróci:
```json
{"status":"ok","data":{"authenticated":true,"email":"<EMAIL>"}}
```

### Krok 5 — Interpretacja wyniku i push notification

**Sukces** (`authenticated: true`):

Wywołaj `PushNotification` z message: `10x auth OK — zalogowany jako <EMAIL>`

Następnie odpowiedz:
```
Autoryzacja zakończona — 10x CLI zalogowany jako <EMAIL>.
```

**Pierwsze uruchomienie / sesja Chrome wygasła:**

Wywołaj `PushNotification` z message: `10x auth — wymagane 2FA dla <EMAIL>`

Następnie odpowiedz:
```
W oknie Chrome zaloguj się na <EMAIL> (z 2FA).
Sesja zostanie zapisana — kolejne uruchomienia są automatyczne.
```

**Timeout Playwright** (output zawiera "Timeout"):

Wywołaj `PushNotification` z message: `10x auth TIMEOUT — email nie dotarł dla <EMAIL>`

Następnie odpowiedz:
```
Email z magic linkiem nie dotarł w 180 sekund.
Możliwe przyczyny:
- AVG zablokował 10x auth — sprawdź/wyłącz tymczasowo AVG
- Outlook nie jest zalogowany — zamknij Chrome i uruchom ponownie
```

**Błąd NODE_OPTIONS / TLS:**

Wywołaj `PushNotification` z message: `10x auth BŁĄD TLS dla <EMAIL> — sprawdź NODE_OPTIONS`

Następnie odpowiedz:
```
Uruchom: $env:NODE_OPTIONS="--use-system-ca"; 10x auth --email <EMAIL>
AVG wymaga tej flagi do poprawnej weryfikacji certyfikatów.
```

## Guardrails

- Playwright używa wyłącznie `outlook.office.com` — nie modyfikuje danych, tylko czyta inbox i przenosi mail do Deleted Items
- Mail jest przenoszony do kosza (Deleted Items), nie usuwany permanentnie
- Sesja Chrome zapisana w `~/.outlook-magic-link-session` — nie udostępniaj tego katalogu
