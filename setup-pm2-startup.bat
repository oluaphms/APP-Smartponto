@echo off
chcp 65001 >nul
echo ========================================
echo  Configurar Startup Automático do PM2
echo ========================================
echo.
echo Este script deve ser executado como ADMINISTRADOR!
echo.
echo Pressione qualquer tecla para continuar...
pause >nul

echo.
echo [1/3] Criando tarefa agendada...
schtasks /create /tn "ClockAgent-PM2" /tr "cmd /c cd /d D:\PontoWebDesk && pm2 resurrect" /sc onlogon /rl highest /f

if %errorlevel% neq 0 (
    echo.
    echo ERRO: Não foi possível criar a tarefa.
    echo Certifique-se de executar este script como Administrador.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Salvando configuração do PM2...
cd /d D:\PontoWebDesk
pm2 save

echo.
echo [3/3] Configuração concluída!
echo.
echo O agente será iniciado automaticamente quando você fizer logon.
echo.
echo Comandos úteis:
echo   pm2 status        - Ver status do agente
echo   pm2 logs          - Ver logs em tempo real
echo   pm2 stop all      - Parar todos os processos
echo   pm2 restart all   - Reiniciar todos os processos
echo.
pause
