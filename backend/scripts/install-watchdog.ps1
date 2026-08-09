# One-time installer for the SafePay demo watchdog.
# - Adds a silent launcher to the current user's Startup folder (runs at every logon)
# - Starts the watchdog immediately
# Run:  powershell -ExecutionPolicy Bypass -File scripts\install-watchdog.ps1

$watchdog = Join-Path $PSScriptRoot 'watchdog.ps1'
$startup  = [Environment]::GetFolderPath('Startup')
$launcher = Join-Path $startup 'SafePayWatchdog.vbs'

# VBScript launcher = starts PowerShell fully hidden (no console flash at logon).
$vbs = 'CreateObject("Wscript.Shell").Run "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""' + $watchdog + '""", 0, False'
Set-Content -Path $launcher -Value $vbs -Encoding ascii
Write-Host "Installed startup launcher: $launcher"

# Start it now (same hidden mechanism).
Start-Process -FilePath 'wscript.exe' -ArgumentList "`"$launcher`""
Write-Host 'Watchdog started. Current public URL is written to Desktop\SafePay-LIVE-URL.txt'
