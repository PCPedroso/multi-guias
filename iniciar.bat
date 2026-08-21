@echo off
title Multi-Guias Desktop (Sessoes Isoladas)
cd /d "%~dp0"
echo ========================================================
echo    Iniciando Multi-Guias com Sessoes 100%% Isoladas...
echo ========================================================
call npm run build
call npx electron .
