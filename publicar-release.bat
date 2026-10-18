@echo off
chcp 65001 >nul
setlocal

rem Publica uma release do Windows com dois cliques: um aqui, outro para
rem confirmar. Enquanto a cota mensal de GitHub Actions nao renova, este e o
rem caminho para quem usa Windows continuar recebendo atualizacao.
rem
rem O npm no Windows e um .cmd: chamar sem "call" encerraria este .bat no meio.

title Publicar Release do GitWeb (Windows)

cd /d "%~dp0GitWeb"
if errorlevel 1 (
    echo.
    echo Nao foi possivel entrar na pasta GitWeb.
    echo Mantenha este arquivo na raiz do repositorio.
    goto :fim
)

echo.
echo ================================================
echo   GitWeb - publicar release do Windows
echo ================================================
echo.
echo Verificando o que seria publicado...
echo.

call npm run release:local -- --dry-run
if errorlevel 1 (
    echo.
    echo ------------------------------------------------
    echo A verificacao falhou. Nada foi publicado.
    echo.
    echo Se a mensagem acima fala em "working tree sujo" ou
    echo em "HEAD nao e igual a origin/main", faca commit e
    echo push das suas alteracoes antes de publicar.
    goto :fim
)

echo.
echo ------------------------------------------------
set "RESP="
set /p "RESP=Publicar esta versao? (S/N): "
if /i not "%RESP%"=="S" (
    echo.
    echo Cancelado. Nada foi publicado.
    goto :fim
)

echo.
echo Construindo e publicando. Isso leva alguns minutos...
echo.

call npm run release:local
if errorlevel 1 (
    echo.
    echo ------------------------------------------------
    echo A publicacao falhou. Veja a mensagem acima.
    goto :fim
)

echo.
echo ------------------------------------------------
echo Release publicada com sucesso.

:fim
echo.
pause
endlocal
