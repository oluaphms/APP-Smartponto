param(
  [Parameter(Mandatory = $true)][string]$Message,
  [Parameter(Mandatory = $true)][string]$LogFile,
  [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO'
)
$ErrorActionPreference = 'Continue'
$logDir = Split-Path -Parent $LogFile
if ($logDir -and -not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

function Protect-LogSecrets {
  param([string]$Text)
  $out = [string]$Text
  $out = [regex]::Replace($out, '\bpac_[A-Za-z0-9_-]+\b', 'pac_[REDACTED]')
  $out = [regex]::Replace($out, '\buag_[A-Za-z0-9_-]+\b', 'uag_[REDACTED]')
  $out = [regex]::Replace($out, '(?i)\bBearer\s+[A-Za-z0-9._\-+=/]+', 'Bearer [REDACTED]')
  $out = [regex]::Replace($out, '\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._\-+=/]+', '[JWT_REDACTED]')
  $out = [regex]::Replace($out, '(?i)(postgres(?:ql)?://)([^:@\s/]+):([^@\s/]+)@', '$1$2:[REDACTED]@')
  $out = [regex]::Replace(
    $out,
    '(?i)("?(?:password|passwd|secret|token|api[_-]?key|jwtSecret|masterJwtSecret|cloudActivationToken|postgresSuperuserPassword|pontowebAppPassword|pontowebMigratePassword|RC2_ACTIVATION_TOKEN)"?\s*[:=]\s*)("?)([^"\s,}\\]+)\2',
    '$1$2[REDACTED]$2'
  )
  return $out
}

$safe = Protect-LogSecrets -Text $Message
$line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $safe
Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
Write-Host $line
