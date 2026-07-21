#Requires -Version 5.1
<#
.SYNOPSIS
    Automatyzuje 10x auth - wysyla magic link i sam go klika pobierajac email przez Graph API.
#>
param(
    [string]$Email = "",
    [int]$TimeoutSeconds = 60,
    [int]$PollIntervalSeconds = 3
)

$ClientId    = "f6a2c67d-bfda-40e6-80cb-ff7455ce267b"
$TenantId    = "omegacode.pl"
$SenderFilter = "noreply@notifications.przeprogramowani.pl"
$TokenCache  = Join-Path $HOME ".auth10x-token.json"
$EmailCache  = Join-Path $HOME ".auth10x-email"

# ── 1. Ustal email ──────────────────────────────────────────────────────────
if (-not $Email) {
    if (Test-Path $EmailCache) {
        $Email = (Get-Content $EmailCache -Raw).Trim()
        Write-Host "Uzywam zapamietanego emaila: $Email" -ForegroundColor DarkGray
    } else {
        $Email = Read-Host "Podaj email do 10x auth"
        if (-not $Email) { Write-Error "Email jest wymagany."; exit 1 }
    }
}
$Email | Out-File $EmailCache -Encoding utf8 -NoNewline

# ── 2. Pobierz access token (z cache lub nowe logowanie) ───────────────────
function Get-GraphToken {
    # Sprobuj odswiezyc z cache
    if (Test-Path $TokenCache) {
        $cached = Get-Content $TokenCache -Raw | ConvertFrom-Json
        $expiry = [datetime]$cached.expires_at
        if ((Get-Date) -lt $expiry.AddMinutes(-5)) {
            return $cached.access_token  # token wciaz wazny
        }
        # Odswierz przez refresh token
        if ($cached.refresh_token) {
            try {
                $refreshed = Invoke-RestMethod -Method POST `
                    -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" `
                    -Body @{
                        grant_type    = "refresh_token"
                        client_id     = $ClientId
                        refresh_token = $cached.refresh_token
                        scope         = "Mail.Read offline_access"
                    } -ErrorAction Stop
                Save-Token $refreshed
                return $refreshed.access_token
            } catch { <# refresh wygas - logujemy ponownie #> }
        }
    }

    # Device code flow - otworz przegladarke z kodem juz wpisanym
    Write-Host "Lacze z Microsoft Graph..." -ForegroundColor Yellow
    $dcResp = Invoke-RestMethod -Method POST `
        -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/devicecode" `
        -Body @{ client_id = $ClientId; scope = "Mail.Read offline_access" }

    Set-Clipboard -Value $dcResp.user_code
    Write-Host ""
    Write-Host "  Kod: $($dcResp.user_code)  (skopiowany do schowka)" -ForegroundColor Yellow
    Write-Host "  Wklej go w przegladarce (Ctrl+V) i zaloguj sie na $Email" -ForegroundColor Yellow
    Write-Host "  (Nie odswiezales tokena ponad 90 dni)" -ForegroundColor DarkGray
    Write-Host ""
    Start-Process "https://microsoft.com/devicelogin"

    # Polluj az user sie zaloguje
    $interval = if ($dcResp.interval) { $dcResp.interval } else { 5 }
    $deadline = (Get-Date).AddSeconds($dcResp.expires_in)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $interval
        try {
            $tokenResp = Invoke-RestMethod -Method POST `
                -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" `
                -Body @{
                    grant_type  = "urn:ietf:params:oauth:grant-type:device_code"
                    device_code = $dcResp.device_code
                    client_id   = $ClientId
                } -ErrorAction Stop
            Save-Token $tokenResp
            Write-Host "Zalogowano do Microsoft Graph." -ForegroundColor Green
            return $tokenResp.access_token
        } catch {
            $err = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($err.error -eq "slow_down") { $interval += 5 }
            elseif ($err.error -ne "authorization_pending") {
                Write-Error "Blad logowania: $($err.error)"; exit 1
            }
        }
    }
    Write-Error "Timeout logowania."; exit 1
}

function Save-Token($resp) {
    @{
        access_token  = $resp.access_token
        refresh_token = $resp.refresh_token
        expires_at    = (Get-Date).AddSeconds($resp.expires_in).ToString("o")
    } | ConvertTo-Json | Out-File $TokenCache -Encoding utf8
}

$AccessToken = Get-GraphToken
$Headers = @{ Authorization = "Bearer $AccessToken" }

# ── 3. Uruchom 10x auth w osobnym oknie ────────────────────────────────────
$StartTime = Get-Date
Write-Host "Uruchamiam: 10x auth --email $Email" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:NODE_OPTIONS='--use-system-ca'; 10x auth --email '$Email'"
Start-Sleep -Seconds 4

# ── 4. Polluj inbox przez Graph API ────────────────────────────────────────
Write-Host "Czekam na magic link od $SenderFilter (max ${TimeoutSeconds}s)..." -ForegroundColor Yellow

$StartIso    = $StartTime.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$ODataFilter = "from/emailAddress/address eq '$SenderFilter' and receivedDateTime ge $StartIso"
$GraphUrl    = "https://graph.microsoft.com/v1.0/me/messages?`$filter=$ODataFilter&`$top=3&`$select=body,receivedDateTime,from"

$Found = $false
for ($elapsed = 4; $elapsed -lt $TimeoutSeconds; $elapsed += $PollIntervalSeconds) {
    Start-Sleep -Seconds $PollIntervalSeconds

    try {
        $resp = Invoke-RestMethod -Uri $GraphUrl -Headers $Headers -ErrorAction Stop
    } catch {
        Write-Warning "Graph API error: $_"
        continue
    }

    if ($resp.value -and $resp.value.Count -gt 0) {
        $Body = $resp.value[0].body.content

        $UrlMatch = [regex]::Match($Body, 'href="(https?://[^"]+)"')
        if (-not $UrlMatch.Success) {
            $UrlMatch = [regex]::Match($Body, 'https?://[^\s<>"]+')
            $Link = $UrlMatch.Value.TrimEnd('.)')
        } else {
            $Link = $UrlMatch.Groups[1].Value
        }

        if ($Link) {
            Write-Host ""
            Write-Host "Link znaleziony po ${elapsed}s! Otwieram przegladarke..." -ForegroundColor Green
            Write-Host "URL: $Link" -ForegroundColor DarkGray
            Start-Process $Link
            $Found = $true
            break
        }
    }

    Write-Host "  ${elapsed}s..." -ForegroundColor DarkGray
}

# ── 5. Wynik ────────────────────────────────────────────────────────────────
Write-Host ""
if ($Found) {
    Write-Host "Gotowe! Sprawdz nowe okno PowerShell - 10x auth powinien skonczyc autoryzacje." -ForegroundColor Green
} else {
    Write-Error "Timeout - magic link nie dotarl w ciagu ${TimeoutSeconds}s"
    exit 1
}
