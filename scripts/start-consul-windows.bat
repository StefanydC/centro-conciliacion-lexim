@echo off
title Consul Agent - Centro de Conciliacion Lexim
cd /d "C:\Users\danie\Downloads\Aplicaciones\consul_1.22.6_windows_386"

echo.
echo =====================================================
echo   Centro de Conciliacion Lexim — Consul Agent
echo =====================================================
echo   Consul UI disponible en http://localhost:8500/ui
echo =====================================================
echo.

consul.exe agent -dev -ui -client=0.0.0.0

pause
