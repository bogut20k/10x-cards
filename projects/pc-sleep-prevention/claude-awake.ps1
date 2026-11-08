# Naciska klawisz F15 (niewidoczny, bez efektu w aplikacjach), dopóki Claude Desktop był aktywny w ostatnich 5 min.
# Nie zmienia ustawień zasilania: gdy Claude jest nieaktywny, skrypt nic nie robi
# i działa zwykły systemowy licznik bezczynności (np. 1 h) -> uśpienie ok. 65 min po ostatniej aktywności.
Add-Type -Namespace Win -Name Key -MemberDefinition '
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);'
$VK_F15 = 0x7E; $KEYEVENTF_KEYUP = 0x0002
$activeWindow = New-TimeSpan -Minutes 5   # jak długo po ostatniej aktywności Claude'a uznajemy go za aktywnego
$dir = "$env:APPDATA\Claude"

while ($true) {
    $last = (Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
    if ($last -and ((Get-Date) - $last) -lt $activeWindow) {
        [Win.Key]::keybd_event($VK_F15, 0, 0, [UIntPtr]::Zero)
        [Win.Key]::keybd_event($VK_F15, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    }
    Start-Sleep -Seconds 60
}
