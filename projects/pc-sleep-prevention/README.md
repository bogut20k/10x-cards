# pc-sleep-prevention

## Cel
PC z Claude Desktop, sterowany z telefonu. Windows usypia po 1 h bezczynności (liczy tylko mysz/klawiaturę
lokalnie), nawet gdy Claude pracuje. Chcemy: uśpienie dopiero po 1 h bez aktywności **Claude**.

## Rozwiązanie (wersja startowa)
`claude-awake.ps1` – pętla co 60 s; jeśli cokolwiek w `%APPDATA%\Claude` zmieniło się < 60 min temu,
ustawia `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)`, w przeciwnym razie zwalnia blokadę.

## Uruchomienie
1. Skopiuj do `C:\Tools\claude-awake.ps1`.
2. Test: `powershell -ExecutionPolicy Bypass -File C:\Tools\claude-awake.ps1`
3. Autostart: Harmonogram zadań → wyzwalacz "Przy logowaniu" →
   `powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Tools\claude-awake.ps1`

## Do zrobienia / przypomnienie na nową sesję
- [ ] Sprawdzić `powercfg /requests` podczas zadania zleconego z telefonu – czy Claude Desktop sam blokuje uśpienie.
- [ ] Zweryfikować, czy zapisy w `%APPDATA%\Claude` faktycznie odzwierciedlają aktywność (inaczej: kryterium CPU procesu `claude.exe`).
- [ ] Ustalić: laptop czy desktop (zamknięcie klapy usypia mimo skryptu).
- [ ] Wyjaśnić wiadomość użytkownika: "na MT jest reklama i nie została wyłączona" – niejasne (MT = ?), czekamy na doprecyzowanie.
