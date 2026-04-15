@echo off
setlocal

where nginx >nul 2>nul
if errorlevel 1 (
  echo nginx no esta en PATH.
  exit /b 1
)

nginx -p "%~dp0" -c "nginx/nginx.local.conf" -s stop
if errorlevel 1 (
  echo No se pudo detener nginx o no estaba corriendo.
  exit /b 1
)

echo nginx detenido.
exit /b 0
