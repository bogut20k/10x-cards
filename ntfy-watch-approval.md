# Zatwierdzanie próśb Claude Code z zegarka (ntfy + hook PermissionRequest)

Cel: gdy Claude Code zatrzymuje się z prośbą o pozwolenie, na telefon (i zegarek Wear OS,
gdy telefon jest zablokowany) przychodzi powiadomienie z treścią prośby i przyciskami
Allow / Deny. Poza tym żadnych powiadomień (bez „zadanie zakończone").

Ograniczenia:
- Przyciski działają tylko dla próśb o pozwolenie (Bash, Edit, Write itd.). Pytania tekstowe
  i `AskUserQuestion` wymagają odpowiedzi w terminalu.
- W trybie `auto` / `bypassPermissions` Claude rzadko pyta, więc nic nie przyjdzie.
- Przyciski ntfy na zegarku są odbijane z telefonu według opisów innych projektów;
  zweryfikuj pierwszym testem na własnym zegarku.
- Usuwanie powiadomienia (DELETE) wymaga nowszego ntfy (ok. v2.14+). Gdy hook zostanie
  zabity przez Claude Code (odpowiedź w terminalu), na Windows sprzątanie może się nie
  wykonać i powiadomienie zostanie. Późniejsze stuknięcie jest nieszkodliwe.

## Prompt do wklejenia w innym projekcie

```
Skonfiguruj w tym projekcie zatwierdzanie próśb o pozwolenie przez ntfy, według
instrukcji z pliku ntfy-watch-approval.md (sekcje „Skrypt" i „settings.json").
1. Utwórz .claude/hooks/ntfy_permission.py ze skryptu z pliku.
2. Dopisz hook PermissionRequest do .claude/settings.json (nie nadpisuj istniejących hooków).
3. Nie wpisuj nazw topiców do repozytorium; skrypt czyta NTFY_TOPIC i NTFY_RESPONSE_TOPIC
   ze zmiennych środowiskowych. Dopisz do README krótką informację, jak je ustawić.
4. Nie dodawaj powiadomień o zakończeniu zadań.
```

## Zmienne środowiskowe (poza repozytorium)

Użyj długich, losowych nazw. Na publicznym ntfy.sh topic jest jedynym zabezpieczeniem:
kto go zna, widzi komendy i może wysłać `allow:<id>`.

```powershell
setx NTFY_TOPIC "otomoto-radek20k-<losowy>-ask"
setx NTFY_RESPONSE_TOPIC "otomoto-radek20k-<losowy>-reply"
```

Potem nowy terminal i restart Claude Code. W aplikacji ntfy na telefonie zasubskrybuj
tylko topic `-ask`. Opcjonalnie `NTFY_SERVER` dla własnego serwera (domyślnie https://ntfy.sh).

## Skrypt: `.claude/hooks/ntfy_permission.py`

```python
import json, os, sys, time, urllib.request, uuid

BASE = os.environ.get("NTFY_SERVER", "https://ntfy.sh")
ASK, REPLY = os.environ.get("NTFY_TOPIC"), os.environ.get("NTFY_RESPONSE_TOPIC")
if not ASK or not REPLY:
    sys.exit(0)

d = json.load(sys.stdin)
tool, inp = d.get("tool_name", ""), d.get("tool_input", {}) or {}
detail = inp.get("command") or inp.get("file_path") or inp.get("url") or json.dumps(inp, ensure_ascii=False)
project = os.path.basename(d.get("cwd", "").rstrip("/\\")) or "projekt"
rid, since = uuid.uuid4().hex[:8], int(time.time())
reply = f"{BASE}/{REPLY}"
notif_url = f"{BASE}/{ASK}/{rid}"  # sequence id = rid, pozwala usunąć powiadomienie
actions = (f"http, Allow, {reply}, method=POST, body=allow:{rid}, clear=true; "
           f"http, Deny, {reply}, method=POST, body=deny:{rid}, clear=true")
title = f"Claude ({project}): {tool}".encode("ascii", "replace").decode()


def cleanup():
    try:
        urllib.request.urlopen(urllib.request.Request(notif_url, method="DELETE"), timeout=5)
    except Exception:
        pass


try:
    urllib.request.urlopen(urllib.request.Request(
        notif_url, data=detail[:1500].encode(),
        headers={"Title": title, "Priority": "high", "Actions": actions}), timeout=10)
except Exception:
    sys.exit(0)

try:
    deadline = time.time() + 110
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{reply}/json?poll=1&since={since}", timeout=10) as r:
                for line in r.read().decode().splitlines():
                    msg = json.loads(line).get("message", "")
                    if msg in (f"allow:{rid}", f"deny:{rid}"):
                        behavior = msg.split(":")[0]
                        dec = {"behavior": behavior}
                        if behavior == "deny":
                            dec["message"] = "Odrzucono z zegarka/telefonu"
                        print(json.dumps({"hookSpecificOutput": {
                            "hookEventName": "PermissionRequest", "decision": dec}}))
                        sys.exit(0)
        except SystemExit:
            raise
        except Exception:
            pass
        time.sleep(2)
finally:
    cleanup()
```

Zachowanie: brak odpowiedzi w ok. 110 s = brak outputu, zwykły dialog w terminalu.
Brak zmiennych środowiskowych lub błąd sieci = brak outputu (hook nigdy nie blokuje pracy).

## `.claude/settings.json` (dopisz do istniejącego `hooks`)

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "python .claude/hooks/ntfy_permission.py", "timeout": 130 }
        ]
      }
    ]
  }
}
```

Na Linux/macOS użyj `python3`. Dla trybu globalnego wstaw ścieżkę bezwzględną
do `~/.claude/settings.json`.

## Test

1. Zablokuj telefon.
2. Poproś Claude o komendę spoza listy `allow`.
3. Sprawdź, czy zegarek pokazuje treść komendy i przyciski Allow/Deny, i czy tap działa.
4. Odpowiedz w terminalu przy kolejnej prośbie i zobacz, czy powiadomienie znika.
