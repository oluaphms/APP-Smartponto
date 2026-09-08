param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$ProgramDataDir,
  [string]$LogFile = (Join-Path $ProgramDataDir 'Logs\installer.log'),
  # Padrao: PRESERVA ProgramData (banco, secrets, MachineId, autorizacao).
  # Remocao so com -RemoveProgramData explicito (task Inno "removedata").
  [switch]$KeepProgramData,
  [switch]$RemoveProgramData
)
$ErrorActionPreference = 'Continue'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Log {
  param(
    [string]$Message,
    [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO'
  )
  & (Join-Path $scriptDir 'professional-write-log.ps1') -Message $Message -LogFile $LogFile -Level $Level
}

Write-Log 'professional-uninstall iniciado'

& (Join-Path $scriptDir 'professional-rollback.ps1') `
  -InstallDir $InstallDir `
  -ProgramDataDir $ProgramDataDir `
  -LogFile $LogFile `
  -Reason 'desinstalacao solicitada'

# Compat: -KeepProgramData (legado) ou ausencia de -RemoveProgramData → preservar dados.
$wipe = $RemoveProgramData -and -not $KeepProgramData
if ($wipe) {
  Write-Log 'Removendo ProgramData (opcao explicita -RemoveProgramData)...' 'WARN'
  if (Test-Path -LiteralPath $ProgramDataDir) {
    try {
      Remove-Item -LiteralPath $ProgramDataDir -Recurse -Force -ErrorAction Stop
      Write-Log "ProgramData removido: $ProgramDataDir"
    } catch {
      Write-Log "Nao foi possivel remover ProgramData: $_" 'WARN'
    }
  }
} else {
  Write-Log "ProgramData preservado (banco/secrets/MachineId): $ProgramDataDir"
  Write-Log 'Para apagar dados do cliente explicitamente, use -RemoveProgramData na desinstalacao.'
}

Write-Log 'professional-uninstall OK'
exit 0
