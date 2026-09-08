#Requires -RunAsAdministrator
<#
.SYNOPSIS
  ACL restritiva em ProgramData\PontoWebDesk\Config (secrets.json e pasta Config).
  Administrators + SYSTEM somente — remove Users/Everyone.
#>
param(
  [Parameter(Mandatory = $true)][string]$ProgramDataDir,
  [string]$LogFile = ''
)
$ErrorActionPreference = 'Continue'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Log {
  param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO')
  if (-not $LogFile) { Write-Host $Message; return }
  & (Join-Path $scriptDir 'professional-write-log.ps1') -Message $Message -LogFile $LogFile -Level $Level
}

$configDir = Join-Path $ProgramDataDir 'Config'
$secrets = Join-Path $configDir 'secrets.json'
$targets = @()
if (Test-Path -LiteralPath $configDir) { $targets += $configDir }
if (Test-Path -LiteralPath $secrets) { $targets += $secrets }

foreach ($target in $targets) {
  try {
    & icacls.exe $target /inheritance:r 2>&1 | Out-Null
    $grants = @('Administrators:(OI)(CI)F', 'SYSTEM:(OI)(CI)F')
    if ($env:USERNAME) {
      $acct = if ($env:USERDOMAIN) { "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F" } else { "$($env:USERNAME):(OI)(CI)F" }
      $grants += $acct
    }
    & icacls.exe $target /grant:r @grants 2>&1 | Out-Null
    foreach ($remove in @('Users', 'Authenticated Users', 'Everyone', 'Todos')) {
      & icacls.exe $target /remove $remove 2>$null | Out-Null
    }
    Write-Log "ACL restritiva aplicada: $target"
  } catch {
    Write-Log "ACL falhou (best-effort): $target — $($_.Exception.Message)" 'WARN'
  }
}
