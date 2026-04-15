@echo off
setlocal

pushd "%~dp0auth-service"

if not exist "node_modules" (
  echo Instalando dependencias de auth-service...
  call npm install
  if errorlevel 1 (
    echo Fallo npm install.
    popd
    exit /b 1
  )
)

if not exist ".env" (
  echo No existe auth-service\.env
  echo Crea el archivo con: copy .env.example .env
  echo Luego ajusta MONGO_URI y JWT_SECRET para tu entorno local.
  popd
  exit /b 1
)

echo Iniciando auth-service en http://localhost:3001 ...
call npm start
set EXIT_CODE=%ERRORLEVEL%

popd
exit /b %EXIT_CODE%
