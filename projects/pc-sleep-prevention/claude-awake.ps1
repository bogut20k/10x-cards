# Blokuje uśpienie Windows, dopóki Claude Desktop był aktywny w ciągu ostatnich 60 min.
# Po godzinie bez aktywności zwalnia blokadę -> działa zwykły licznik systemowy.
Add-Type -Namespace Win -Name Pwr -MemberDefinition '
[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
$ES_CONTINUOUS = 0x80000000; $ES_SYSTEM_REQUIRED = 0x00000001
$idleLimit = New-TimeSpan -Minutes 60
$dir = "$env:APPDATA\Claude"

while ($true) {
    $last = (Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
    if ($last -and ((Get-Date) - $last) -lt $idleLimit) {
        [Win.Pwr]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED) | Out-Null
    } else {
        [Win.Pwr]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
    }
    Start-Sleep -Seconds 60
}
