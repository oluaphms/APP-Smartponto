# Reinstala dependências do projeto (rode em PowerShell, de preferência como Administrador)
# Feche o Cursor/IDE e terminais que usem o projeto antes de rodar.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Removendo node_modules..." -ForegroundColor Yellow
if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules
}

Write-Host "Instalando dependências..." -ForegroundColor Yellow
npm install

if (Test-Path "node_modules\vite") {
    Write-Host "OK: Vite instalado. Rode: npm run dev" -ForegroundColor Green
} else {
    Write-Host "AVISO: vite ainda nao encontrado em node_modules. Tente desinstalar o vite global: npm uninstall -g vite" -ForegroundColor Red
}
