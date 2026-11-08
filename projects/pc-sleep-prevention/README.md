# pc-sleep-prevention

## Cel
PC z Claude Desktop, sterowany z telefonu. Windows usypia po 1 h bezczynności (liczy tylko mysz/klawiaturę
lokalnie), nawet gdy Claude pracuje. Chcemy: uśpienie dopiero po 1 h bez aktywności **Claude**.

## Rozwiązanie (wersja startowa)
`claude-awake.ps1` – pętla co 60 s; jeśli cokolwiek w `%APPDATA%\Claude` zmieniło się < 5 min temu,
rusza myszką o 1 px i z powrotem (`mouse_event`), co zeruje systemowy licznik bezczynności.
Nie zmienia ustawień zasilania. Po ustaniu aktywności Claude systemowy licznik (1 h) usypia PC ok. 65 min później.
Uwaga: ruch myszy zeruje też licznik wygaszania ekranu; alternatywa: klawisz F15. Działanie na zablokowanym ekranie do przetestowania.

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
