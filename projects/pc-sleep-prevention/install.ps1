# Instalator: kopiuje claude-awake.ps1 do %LOCALAPPDATA%\claude-awake, rejestruje zadanie
# "ClaudeAwake" uruchamiane przy logowaniu (ukryte) i od razu je startuje. Admin niepotrzebny.
$src  = Join-Path $PSScriptRoot 'claude-awake.ps1'
$dest = Join-Path $env:LOCALAPPDATA 'claude-awake'
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item $src $dest -Force
$script = Join-Path $dest 'claude-awake.ps1'

$action   = New-ScheduledTaskAction -Execute 'powershell.exe' `
            -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName 'ClaudeAwake' -Action $action -Trigger $trigger `
            -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'ClaudeAwake'
Write-Host "Zainstalowano i uruchomiono zadanie ClaudeAwake. Usuń: Unregister-ScheduledTask ClaudeAwake -Confirm:`$false"
