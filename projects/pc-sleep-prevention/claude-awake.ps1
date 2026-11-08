# Rusza myszką o 1 px (i z powrotem), dopóki Claude Desktop był aktywny w ostatnich 5 min.
# Nie zmienia ustawień zasilania: gdy Claude jest nieaktywny, skrypt nic nie robi
# i działa zwykły systemowy licznik bezczynności (np. 1 h) -> uśpienie ok. 65 min po ostatniej aktywności.
Add-Type -Namespace Win -Name Mouse -MemberDefinition '
[DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, UIntPtr e);'
$MOUSEEVENTF_MOVE = 0x0001
$activeWindow = New-TimeSpan -Minutes 5   # jak długo po ostatniej aktywności Claude'a uznajemy go za aktywnego
$dir = "$env:APPDATA\Claude"

while ($true) {
    $last = (Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
    if ($last -and ((Get-Date) - $last) -lt $activeWindow) {
        [Win.Mouse]::mouse_event($MOUSEEVENTF_MOVE, 1, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 100
        [Win.Mouse]::mouse_event($MOUSEEVENTF_MOVE, -1, 0, 0, [UIntPtr]::Zero)
    }
    Start-Sleep -Seconds 60
}
