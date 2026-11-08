# HANDOFF – kontynuacja projektu pc-sleep-prevention (po polsku)

Repo: `bogut20k/10x-cards`, gałąź `claude/pc-sleep-prevention-claude-vpfa17`, folder `projects/pc-sleep-prevention/`
(pliki: `claude-awake.ps1`, `install.ps1`, `README.md`, `HANDOFF.md`).
Użytkownik: Windows, nazwa użytkownika `a1`. Ma Claude Desktop na PC i pisze do niego z telefonu.

## Problem
Windows usypia PC po 1 h bezczynności, ale liczy tylko mysz/klawiaturę lokalnie. Gdy Claude pracuje nad zadaniem
zleconym z telefonu, PC i tak zasypia. Cel: uśpienie dopiero po 1 h bez aktywności **Claude'a**.
Użytkownik NIE chce zmieniać systemowych ustawień zasilania (`SetThreadExecutionState`/powercfg), tylko symulować aktywność.

## Decyzje podjęte w rozmowie
1. Pierwsza wersja używała `SetThreadExecutionState`; użytkownik wolał symulowany ruch → przerobione na mysz → potem na **klawisz F15**.
2. Okno aktywności Claude'a = **5 min** (nie 60), żeby uśpienie nastąpiło ok. 65 min po ostatniej aktywności, a nie ok. 2 h.
3. Aktywność Claude'a wykrywana heurystyką: najnowszy `LastWriteTime` pliku w `%APPDATA%\Claude` < 5 min.
4. Instalacja do `C:\Users\a1\.claude\claude-awake\` + zadanie Harmonogramu `ClaudeAwake` (start przy logowaniu, ukryte, bez admina).
   Usunięcie: `Unregister-ScheduledTask ClaudeAwake -Confirm:$false`.

## Stan
- Kod gotowy i wypchnięty. **Nic nie zostało uruchomione ani przetestowane na Windowsie** (poprzednia sesja była w chmurowym kontenerze Linux).

## Do zrobienia
1. Uruchomić na PC: `powershell -ExecutionPolicy Bypass -File .\install.ps1` (z folderu projektu) i sprawdzić `Get-ScheduledTask ClaudeAwake`.
2. `powercfg /requests` podczas zadania zleconego z telefonu – czy Claude Desktop sam blokuje uśpienie (wtedy skrypt może być zbędny).
3. Zweryfikować, czy zapisy w `%APPDATA%\Claude` pojawiają się podczas pracy z telefonu; jeśli nie → kryterium: użycie CPU procesu `claude.exe`.
4. Przetestować na zablokowanym ekranie (Win+L) i czy F15 nie wywołuje akcji w żadnej aplikacji użytkownika.
5. Ustalić: laptop czy desktop (zamknięcie klapy usypia mimo skryptu).
6. Niejasne zdanie użytkownika: „na MT jest reklama i nie została wyłączona" – nie wiadomo, czym jest MT; dopytać.

## Zasady
Commity na gałęzi `claude/pc-sleep-prevention-claude-vpfa17`. PR tylko na wyraźną prośbę.
