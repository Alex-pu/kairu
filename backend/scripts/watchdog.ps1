# SafePay demo watchdog — keeps the local server AND the public tunnel alive.
#
# Every ~45s it checks:
#   1. Is the app healthy on http://localhost:4000?  If not -> restart it
#      (first keeping the database; if that fails, with a fresh database).
#   2. Is the public trycloudflare URL healthy?      If not -> restart the tunnel
#      and write the NEW public URL to Desktop\SafePay-LIVE-URL.txt.
#
# Install: run scripts\install-watchdog.ps1 once (adds it to Windows startup).
# NOTE: a quick-tunnel URL CHANGES on every tunnel restart. This watchdog keeps
# the demo reachable, but only cloud hosting (see render.yaml) gives a fixed URL.

$ErrorActionPreference = 'SilentlyContinue'

# Only one watchdog at a time.
$mutex = New-Object System.Threading.Mutex($false, 'SafePayWatchdog')
if (-not $mutex.WaitOne(0)) { exit }

$backendDir  = Split-Path -Parent $PSScriptRoot                       # ...\backend
$node        = 'C:\n20\node.exe'
$cloudflared = 'C:\n20\cloudflared.exe'
$urlFile     = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SafePay-LIVE-URL.txt'
$tunnelLog   = Join-Path $env:TEMP 'safepay-tunnel.log'
$logFile     = Join-Path $env:TEMP 'safepay-watchdog.log'

function Log($msg) { Add-Content -Path $logFile -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) }

function Test-Health($base) {
  try { return ((Invoke-WebRequest -UseBasicParsing "$base/health" -TimeoutSec 6).StatusCode -eq 200) } catch { return $false }
}

function Stop-Stack {
  Get-WmiObject Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'dev-local|src[\\/]server' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-WmiObject Win32_Process -Filter "Name='postgres.exe'" |
    Where-Object { $_.CommandLine -match 'safepay-devlocal-pgdata' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Sleep -Seconds 1
}

function Start-AppServer([bool]$keepData) {
  Stop-Stack
  if ($keepData) { $env:DEV_LOCAL_KEEP_DATA = '1' } else { Remove-Item Env:DEV_LOCAL_KEEP_DATA }
  Start-Process -FilePath $node -ArgumentList 'scripts/dev-local.mjs' -WorkingDirectory $backendDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $env:TEMP 'safepay-dev.out') -RedirectStandardError (Join-Path $env:TEMP 'safepay-dev.err')
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Health 'http://localhost:4000') { return $true }
  }
  return $false
}

function Start-Tunnel {
  Get-Process cloudflared | Stop-Process -Force
  Remove-Item $tunnelLog -Force
  Start-Process -FilePath $cloudflared -ArgumentList 'tunnel','--url','http://localhost:4000','--protocol','http2','--edge-ip-version','4' -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $env:TEMP 'safepay-tunnel.out') -RedirectStandardError $tunnelLog
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($m) {
      $url = $m.Matches[0].Value
      Set-Content -Path $urlFile -Value @(
        $url,
        '',
        "Live since: $(Get-Date)",
        'This address changes whenever the tunnel restarts.',
        'For a PERMANENT address, deploy to Render (see render.yaml / docs).'
      )
      Log "Tunnel up: $url"
      return $url
    }
  }
  Log 'Tunnel failed to start.'
  return $null
}

Log 'Watchdog started.'
# Keep Windows awake while the watchdog runs (display may still turn off).
try {
  $sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
  $k = Add-Type -MemberDefinition $sig -Name 'Power' -Namespace 'SafePay' -PassThru
  $k::SetThreadExecutionState([uint32]'0x80000003') | Out-Null   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch {}

while ($true) {
  # --- 1. the app itself ---
  if (-not (Test-Health 'http://localhost:4000')) {
    Log 'App unhealthy -> restart (keeping data)...'
    if (-not (Start-AppServer $true)) {
      Log 'Keep-data restart failed -> fresh database...'
      Start-AppServer $false | Out-Null
    }
  }

  # --- 2. the public tunnel ---
  $currentUrl = $null
  if (Test-Path $urlFile) { $currentUrl = (Get-Content $urlFile -TotalCount 1) }
  $tunnelAlive = (Get-Process cloudflared) -and $currentUrl -and (Test-Health $currentUrl)
  if (-not $tunnelAlive) {
    Log 'Tunnel unhealthy -> restarting...'
    Start-Tunnel | Out-Null
  }

  Start-Sleep -Seconds 45
}
