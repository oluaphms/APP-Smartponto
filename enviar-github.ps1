# ============================================================
# Script para enviar SmartPonto para GitHub
# Execute no PowerShell como Administrador: .\enviar-github.ps1
# ============================================================

Write-Host "🚀 Enviando SmartPonto para GitHub..." -ForegroundColor Cyan

# Mudar para o diretório do projeto
Set-Location "D:\APP Smartponto"

# Remover lock do Git se existir
if (Test-Path ".git\index.lock") {
    Write-Host "⚠️  Removendo lock do Git..." -ForegroundColor Yellow
    try {
        Remove-Item ".git\index.lock" -Force -ErrorAction Stop
        Write-Host "✅ Lock removido" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao remover lock. Feche outros processos Git e tente novamente." -ForegroundColor Red
        Write-Host "   Ou remova manualmente: .git\index.lock" -ForegroundColor Yellow
        exit 1
    }
}

# Configurar Git (se necessário)
git config core.autocrlf input

# 1. Adicionar TODOS os arquivos
Write-Host "`n📦 Adicionando arquivos..." -ForegroundColor Cyan
git add -A

# 2. Verificar status
Write-Host "`n📋 Status do repositório:" -ForegroundColor Cyan
git status

# 3. Verificar se há mudanças para commitar
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "`n✅ Nenhuma mudança para commitar. Working tree está limpo." -ForegroundColor Green
    Write-Host "`n🔄 Sincronizando com remoto..." -ForegroundColor Cyan
    git pull origin main --rebase
    Write-Host "`n✅ Sincronização concluída!" -ForegroundColor Green
    exit 0
}

# 4. Fazer commit
Write-Host "`n💾 Fazendo commit..." -ForegroundColor Cyan
$commitMessage = "feat: adicionar todas as melhorias e implementações recentes

- Notificações in-app (centro de notificações)
- Permissões granulares (roles e permissões)
- Export Excel (.xlsx)
- Acessibilidade (ARIA labels, navegação por teclado)
- Internacionalização (i18n pt-BR/en-US)
- Modo escuro automático
- Analytics avançado (métricas comparativas)
- Integração calendário (feriados)
- Storage bucket photos
- Audit logs em banco
- Export PDF
- Push/lembretes
- Testes (Vitest)
- Segurança (zod, headers)
- Monitoramento (Sentry)
- Documentação completa"

git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Erro ao fazer commit" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Commit realizado com sucesso!" -ForegroundColor Green

# 5. Sincronizar com remoto
Write-Host "`n🔄 Sincronizando com remoto (pull --rebase)..." -ForegroundColor Cyan
git pull origin main --rebase

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n⚠️  Conflitos detectados. Resolva manualmente e execute novamente." -ForegroundColor Yellow
    exit 1
}

# 6. Enviar para GitHub
Write-Host "`n📤 Enviando para GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Sucesso! Código enviado para GitHub." -ForegroundColor Green
    Write-Host "`n🔗 Repositório: https://github.com/oluaphms/APP-Smartponto.git" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Erro ao enviar para GitHub" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Concluído!" -ForegroundColor Green
