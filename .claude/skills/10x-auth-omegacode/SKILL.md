---
name: 10x-auth-omegacode
description: >
  Automatyzuje logowanie do 10x-cli przez magic link. Uruchamia skrypt auth10x.ps1,
  który wywołuje `10x auth --email rk@omegacode.pl`, pobiera magic link z Outlooka
  przez Microsoft Graph API i automatycznie go otwiera w przeglądarce.
  Przy pierwszym uruchomieniu otworzy okno przeglądarki do zalogowania M365 —
  to jednorazowe; potem token jest cache'owany.
  Trigger phrases: "zaloguj 10x", "10x auth", "auth 10x", "zaloguj się do 10x",
  "odśwież token 10x", "10x login".
argument-hint: "[--email adres@email.com]"
allowed-tools:
  - PowerShell
  - Bash
---

# 10x Auth — automatyczne logowanie przez magic link

Skill wywołuje `C:\Users\Radoslaw\auth10x.ps1`, który:
1. Łączy się z Microsoft Graph API (M365, konto `rk@omegacode.pl`)
2. Uruchamia `10x auth --email rk@omegacode.pl` w osobnym oknie PowerShell
3. Polluje inbox co kilka sekund, szukając emaila od `noreply@notifications.przeprogramowani.pl`
4. Wyciąga magic link i otwiera go w przeglądarce
5. `10x auth` w tle dostaje token i kończy autoryzację

## Pierwsze uruchomienie (brak cached tokena Graph)

Przeglądarka otworzy się automatycznie z ekranem logowania Microsoft 365.
Użytkownik loguje się na `rk@omegacode.pl` i akceptuje uprawnienie `Mail.Read`.
Token jest cache'owany przez MSAL — kolejne uruchomienia są w pełni automatyczne.

## Workflow

### Krok 1 — Sprawdź czy skrypt istnieje

```powershell
Test-Path "C:\Users\Radoslaw\auth10x.ps1"
```

Jeśli zwróci `False`:

```
Skrypt C:\Users\Radoslaw\auth10x.ps1 nie istnieje.
Odtwórz go z pamięci projektu: context projektu 10x-auth-automation.
```

STOP.

### Krok 2 — Sprawdź czy moduły Graph są zainstalowane

```powershell
$missing = @("Microsoft.Graph.Authentication","Microsoft.Graph.Mail") | Where-Object {
    -not (Get-Module -ListAvailable -Name $_ -ErrorAction SilentlyContinue)
}
$missing
```

Jeśli lista nie jest pusta — zainstaluj brakujące moduły:

```powershell
Install-Module $missing -Scope CurrentUser -Force -AllowClobber
```

### Krok 3 — Uruchom skrypt

Uruchom skrypt i przekaż output na bieżąco:

```powershell
& "C:\Users\Radoslaw\auth10x.ps1"
```

Jeśli użytkownik podał argument `--email inny@email.com`, przekaż go:

```powershell
& "C:\Users\Radoslaw\auth10x.ps1" -Email "inny@email.com"
```

### Krok 4 — Interpretacja wyniku

**Sukces** (exit code 0, output zawiera "Gotowe"):
```
Autoryzacja zakończona. 10x auth powinien mieć ważny token.
Sprawdź: 10x auth --status
```

**Błąd Graph API / token wygasł** (output zawiera "AADSTS" lub "InteractionRequired"):
```
Token M365 wygasł lub wymaga ponownego logowania.
Skrypt otworzy przeglądarkę — zaloguj się na rk@omegacode.pl i zaakceptuj Mail.Read.
```
Uruchom skrypt ponownie — `Connect-MgGraph` otworzy przeglądarkę automatycznie.

**Timeout** (output zawiera "Timeout"):
```
Email z magic linkiem nie dotarł w 60 sekund.
Możliwe przyczyny:
- AVG zablokował `10x auth` (sprawdź wyjątki AVG)
- Email trafił do folderu Spam
- 10x CLI nie wysłało żądania (sprawdź nowe okno PowerShell)
```

**Outlook / Graph niedostępny**:
```
Błąd połączenia z Microsoft Graph.
Sprawdź połączenie internetowe i spróbuj ponownie.
```

## Guardrails

- Skill używa wyłącznie `Mail.Read` — nie modyfikuje, nie usuwa, nie wysyła emaili.
- Nie zapisuje żadnych plików poza cache tokenów MSAL (zarządzanym przez system).
- Jeśli skrypt nie istnieje, STOP — nie odtwarzaj go bez potwierdzenia użytkownika.
