param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$ProgramDataDir,
  [Parameter(Mandatory = $true)][string]$LogFile,
  [switch]$Silent,
  [switch]$OpenBrowser
)
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Log {
  param(
    [string]$Message,
    [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO'
  )
  & (Join-Path $scriptDir 'professional-write-log.ps1') -Message $Message -LogFile $LogFile -Level $Level
}

function Invoke-Rollback {
  param([string]$Reason)
  & (Join-Path $scriptDir 'professional-rollback.ps1') `
    -InstallDir $InstallDir `
    -ProgramDataDir $ProgramDataDir `
    -LogFile $LogFile `
    -Reason $Reason
}

function Test-InstallLayout {
  $required = @(
    'Backend\node\node.exe',
    'Backend\server\dist\server.js',
    'Frontend\www\index.html',
    'Database\bin\postgres.exe',
    'Database\VERSION',
    'Database\manifest.json',
    'Bin\api-service-host.js',
    'Bin\serve-frontend.mjs',
    'Bin\apply-installed-database.mjs',
    'Bootstrap\dist\index.js',
    'Bootstrap\package.json',
    'Bootstrap\node_modules\@pontowebdesk\api-service\package.json',
    'Bootstrap\node_modules\@pontowebdesk\api-runtime\package.json',
    'Agent\rep-agent.exe',
    'Migrations\manifest.json',
    'layout.manifest.json',
    'VERSION'
  )
  $missing = @()
  foreach ($rel in $required) {
    $abs = Join-Path $InstallDir $rel
    if (-not (Test-Path -LiteralPath $abs)) { $missing += $rel }
  }
  if ($missing.Count -gt 0) {
    throw "INSTALL_LAYOUT_INCOMPLETE: faltam $($missing.Count) artefato(s): $($missing -join '; ')"
  }
}

function Test-PostInstallHealth {
  $serviceNames = @('PontoWebDeskPostgreSQL', 'PontoWebDeskApi', 'PontoWebDeskFrontend')
  foreach ($name in $serviceNames) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { throw "POST_INSTALL_SERVICE_MISSING: $name" }
    if ($svc.Status -ne 'Running') {
      throw "POST_INSTALL_SERVICE_NOT_RUNNING: $name status=$($svc.Status)"
    }
  }

  foreach ($port in @(3000, 3010)) {
    $listen = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listen) { throw "POST_INSTALL_PORT_NOT_LISTENING: $port" }
  }

  try {
    $api = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health/live' -UseBasicParsing -TimeoutSec 30
    if ($api.StatusCode -lt 200 -or $api.StatusCode -ge 300) {
      throw "POST_INSTALL_API_HEALTH_NON_2XX: $($api.StatusCode)"
    }
  } catch {
    if ($_.Exception.Message -match 'POST_INSTALL_') { throw }
    throw "POST_INSTALL_API_HEALTH_FAILED: $($_.Exception.Message)"
  }

  try {
    $fe = Invoke-WebRequest -Uri 'http://127.0.0.1:3010/' -UseBasicParsing -TimeoutSec 30
    if ($fe.StatusCode -lt 200 -or $fe.StatusCode -ge 300) {
      throw "POST_INSTALL_FRONTEND_NON_2XX: $($fe.StatusCode)"
    }
  } catch {
    if ($_.Exception.Message -match 'POST_INSTALL_') { throw }
    throw "POST_INSTALL_FRONTEND_FAILED: $($_.Exception.Message)"
  }
}

function Import-CloudActivationIntoEnv {
  <#
    Mecanismo oficial (ordem):
    1) cloud-activation.pending.json em ProgramData\Config (escrito pelo wizard Inno — sem pac_* na cmdline)
    2) Variáveis de ambiente do processo pai: RC2_CLOUD_MASTER_URL + RC2_ACTIVATION_TOKEN
    Nunca loga o plaintext do token.
  #>
  $pending = Join-Path $ProgramDataDir 'Config\cloud-activation.pending.json'
  $hasUrl = -not [string]::IsNullOrWhiteSpace($env:RC2_CLOUD_MASTER_URL)
  $hasToken = -not [string]::IsNullOrWhiteSpace($env:RC2_ACTIVATION_TOKEN)

  if (Test-Path -LiteralPath $pending) {
    try {
      $raw = Get-Content -LiteralPath $pending -Raw -Encoding UTF8
      $doc = $raw | ConvertFrom-Json
      if ($doc.cloudMasterUrl) { $env:RC2_CLOUD_MASTER_URL = [string]$doc.cloudMasterUrl; $hasUrl = $true }
      if ($doc.cloudActivationToken) {
        $tok = [string]$doc.cloudActivationToken
        if ($tok.StartsWith('pac_')) {
          $env:RC2_ACTIVATION_TOKEN = $tok
          $hasToken = $true
        }
      }
      Remove-Item -LiteralPath $pending -Force -ErrorAction SilentlyContinue
      Write-Log 'Ativacao Cloud: pending.json consumido (token nao logado)'
    } catch {
      Write-Log "Ativacao Cloud: pending.json invalido — $($_.Exception.Message)" 'WARN'
      Remove-Item -LiteralPath $pending -Force -ErrorAction SilentlyContinue
    }
  }

  # Professional installer exige ativação Cloud (pac_*) — sem licenseKey como auth.
  $env:RC2_ACTIVATION_REQUIRED = 'true'

  if ($hasUrl) {
    Write-Log 'RC2_CLOUD_MASTER_URL definida (valor nao logado integralmente)'
  } else {
    Write-Log 'RC2_CLOUD_MASTER_URL ausente' 'WARN'
  }
  if ($hasToken) {
    Write-Log 'RC2_ACTIVATION_TOKEN presente (pac_* — nao impresso)'
  } else {
    Write-Log 'RC2_ACTIVATION_TOKEN ausente — first_run deve falhar com ACTIVATION_REQUIRED' 'WARN'
  }
}

try {
  Write-Log -Message 'RC2.4.3 professional-install iniciado'
  Write-Log -Message "InstallDir=$InstallDir ProgramDataDir=$ProgramDataDir"

  Test-InstallLayout
  Write-Log -Message 'Layout Program Files validado (artefatos criticos presentes)'

  $pdDirs = @(
    (Join-Path $ProgramDataDir 'Config'),
    (Join-Path $ProgramDataDir 'Logs'),
    (Join-Path $ProgramDataDir 'Storage'),
    (Join-Path $ProgramDataDir 'Backups'),
    (Join-Path $ProgramDataDir 'Database\pgdata')
  )
  foreach ($d in $pdDirs) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
    Write-Log -Message "ProgramData OK: $d"
  }

  Import-CloudActivationIntoEnv

  # Cluster quebrado: estado INSTALLED sem PG_VERSION (ex.: uninstall parcial / pgdata vazio).
  $pgVersion = Join-Path $ProgramDataDir 'Database\pgdata\PG_VERSION'
  $clusterBroken = -not (Test-Path -LiteralPath $pgVersion)

  # Retentativa: limpa RECOVERY/FAILED; tambem INSTALLED se o cluster embutido sumiu.
  foreach ($sf in @(
      (Join-Path $ProgramDataDir 'install-state.json'),
      (Join-Path $ProgramDataDir 'Config\install-state.json')
    )) {
    if (Test-Path -LiteralPath $sf) {
      try {
        $doc = Get-Content -LiteralPath $sf -Raw -ErrorAction Stop | ConvertFrom-Json
        $resetStates = @('RECOVERY', 'FAILED')
        if ($clusterBroken) { $resetStates += 'INSTALLED' }
        if ($doc.state -in $resetStates) {
          Remove-Item -LiteralPath $sf -Force
          Write-Log -Message "install-state $($doc.state) removido para retentativa: $sf$(if ($clusterBroken) { ' (pgdata sem PG_VERSION)' })"
        }
      } catch {
        Remove-Item -LiteralPath $sf -Force -ErrorAction SilentlyContinue
        Write-Log -Message "install-state invalido removido: $sf" 'WARN'
      }
    }
  }

  # Aviso: Docker/Local SaaS na mesma maquina costuma roubar 3000/3010/5432/55432.
  try {
    $dockerConflict = @(docker ps --format '{{.Names}} {{.Ports}}' 2>$null) |
      Where-Object { $_ -match ':(3000|3010|5432|55432)->' }
    if ($dockerConflict -and $dockerConflict.Count -gt 0) {
      Write-Log -Message 'Conflito Docker detectado nas portas do Professional (3000/3010/5432/55432). Pare os containers SaaS/Local antes do bootstrap.' 'WARN'
      foreach ($line in $dockerConflict) { Write-Log -Message "  docker: $line" 'WARN' }
    }
  } catch {
    # docker CLI ausente — OK para instalacao nativa
  }

  $templates = Join-Path $InstallDir 'Config\templates'
  $pdConfig = Join-Path $ProgramDataDir 'Config'
  if (Test-Path -LiteralPath $templates) {
    Get-ChildItem -LiteralPath $templates -File | ForEach-Object {
      $dest = Join-Path $pdConfig $_.Name
      if (-not (Test-Path -LiteralPath $dest)) {
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
        Write-Log -Message "Config template copiado: $($_.Name)"
      }
    }
  }

  $nodeExe = Join-Path $InstallDir 'Backend\node\node.exe'
  $bootstrapEntry = Join-Path $InstallDir 'Bootstrap\dist\index.js'
  if (-not (Test-Path -LiteralPath $nodeExe)) { throw "NODE_RUNTIME_MISSING: $nodeExe" }
  if (-not (Test-Path -LiteralPath $bootstrapEntry)) { throw "BOOTSTRAP_MISSING: $bootstrapEntry" }

  $env:RC2_PROGRAM_FILES_ROOT = $InstallDir
  $env:RC2_PROGRAM_DATA_ROOT = $ProgramDataDir
  $env:RC2_BOOTSTRAP_MODE = 'embedded'
  # RC2_ACTIVATION_REQUIRED / URL / TOKEN ja definidos em Import-CloudActivationIntoEnv
  # Token NAO vai em ArgumentList do processo — apenas env herdado + SecretsStore no first_run.

  Write-Log -Message 'Executando Bootstrap (embedded): PostgreSQL embedded + API + Frontend + activation gate'
  $bootstrapArg = "`"$bootstrapEntry`""
  $proc = Start-Process -FilePath $nodeExe `
    -ArgumentList $bootstrapArg `
    -WorkingDirectory (Join-Path $InstallDir 'Bootstrap') `
    -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput (Join-Path $ProgramDataDir 'Logs\bootstrap-stdout.log') `
    -RedirectStandardError (Join-Path $ProgramDataDir 'Logs\bootstrap-stderr.log')

  if ($proc.ExitCode -ne 0) {
    $stderrTail = ''
    $errLog = Join-Path $ProgramDataDir 'Logs\bootstrap-stderr.log'
    if (Test-Path -LiteralPath $errLog) {
      $stderrTail = (Get-Content -LiteralPath $errLog -Tail 20 -ErrorAction SilentlyContinue) -join ' | '
    }
    if ($stderrTail -match 'ACTIVATION_REQUIRED|ACTIVATION_NETWORK|ACTIVATION_FAILED|RC2_ACTIVATION') {
      throw "BOOTSTRAP_ACTIVATION_GATE: exit $($proc.ExitCode) — ativacao Professional obrigatoria falhou (ver bootstrap-stderr.log). Sem token/URL validos a instalacao nao fica operacional."
    }
    throw "BOOTSTRAP_FAILED: exit $($proc.ExitCode) - ver Logs\bootstrap-stderr.log e Config\install-state.json"
  }

  Write-Log -Message 'Bootstrap concluido com exit 0'

  & (Join-Path $scriptDir 'professional-secure-config.ps1') `
    -ProgramDataDir $ProgramDataDir `
    -LogFile $LogFile

  Test-PostInstallHealth
  Write-Log -Message 'Pos-install: servicos, portas 3000/3010 e HTTP health OK'

  if ($OpenBrowser -and -not $Silent) {
    Start-Process 'http://127.0.0.1:3010/'
    Write-Log -Message 'Navegador aberto em http://127.0.0.1:3010/'
  }

  Write-Log -Message 'professional-install OK'
  exit 0
} catch {
  Write-Log -Message $_.Exception.Message -Level 'ERROR'
  Invoke-Rollback -Reason $_.Exception.Message
  exit 1
}
