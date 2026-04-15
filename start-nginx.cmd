@echo off
setlocal

where nginx >nul 2>nul
if errorlevel 1 (
  echo nginx no esta en PATH.
  echo Instala nginx para Windows y agrega su carpeta al PATH.
  exit /b 1
)

echo Validando configuracion local de nginx...
nginx -p "%~dp0" -c "nginx/nginx.local.conf" -t
if errorlevel 1 (
  echo La configuracion nginx.local.conf tiene errores.
  exit /b 1
)

echo Iniciando nginx local en http://localhost ...
nginx -p "%~dp0" -c "nginx/nginx.local.conf"
if errorlevel 1 (
  echo No se pudo iniciar nginx.
  exit /b 1
)

echo nginx iniciado correctamente.
echo Para detenerlo: stop-nginx.cmd
exit /b 0
