@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "COMMAND=%~1"
if not defined COMMAND set "COMMAND=start"
set "COMPOSE_FILE=%CD%\docker-compose.dev.yml"

if /i "%COMMAND%"=="help" goto help
if /i "%COMMAND%"=="-h" goto help
if /i "%COMMAND%"=="--help" goto help
if /i "%COMMAND%"=="ps" goto ps
if /i "%COMMAND%"=="logs" goto logs
if /i "%COMMAND%"=="down" goto down
if /i "%COMMAND%"=="up" goto up
if /i "%COMMAND%"=="migrate" goto migrate
if /i "%COMMAND%"=="seed" goto seed
if /i "%COMMAND%"=="setup" goto setup
if /i "%COMMAND%"=="start" goto start

echo Error: unknown command "%COMMAND%".
echo Run dev.cmd help to see the available commands.
exit /b 2

:start
call :check_docker || exit /b 1
call :initialize_app || exit /b 1
call :start_infrastructure || exit /b 1
call :start_app
exit /b %ERRORLEVEL%

:setup
call :check_docker || exit /b 1
call :initialize_app || exit /b 1
call :start_infrastructure || exit /b 1
node ace migration:run || exit /b 1
node ace db:seed || exit /b 1
call :start_app
exit /b %ERRORLEVEL%

:up
call :check_docker || exit /b 1
call :start_infrastructure || exit /b 1
docker compose -f "%COMPOSE_FILE%" ps
exit /b %ERRORLEVEL%

:migrate
call :check_docker || exit /b 1
call :initialize_app || exit /b 1
call :start_infrastructure || exit /b 1
node ace migration:run
exit /b %ERRORLEVEL%

:seed
call :check_docker || exit /b 1
call :initialize_app || exit /b 1
call :start_infrastructure || exit /b 1
node ace db:seed
exit /b %ERRORLEVEL%

:ps
call :check_docker || exit /b 1
docker compose -f "%COMPOSE_FILE%" ps
exit /b %ERRORLEVEL%

:logs
call :check_docker || exit /b 1
docker compose -f "%COMPOSE_FILE%" logs -f --tail=200
exit /b %ERRORLEVEL%

:down
call :check_docker || exit /b 1
docker compose -f "%COMPOSE_FILE%" down
exit /b %ERRORLEVEL%

:help
echo Windows development helper
echo.
echo Usage:
echo   dev.cmd             Start the dev containers and run the app with npm
echo   dev.cmd setup       First-time setup: start, migrate, seed, and run the app
echo   dev.cmd up          Start only the dev containers
echo   dev.cmd migrate     Start containers and run pending migrations
echo   dev.cmd seed        Start containers and run the development seeders
echo   dev.cmd ps          Show dev container status
echo   dev.cmd logs        Follow dev container logs
echo   dev.cmd down        Stop dev containers without deleting their data
echo   dev.cmd help        Show this help
echo.
echo The app runs directly on Windows. Only PostgreSQL, Redis, MinIO, and
echo InfluxDB run in Docker. An existing .env is always preserved.
exit /b 0

:check_docker
where docker.exe >nul 2>nul
if errorlevel 1 (
  echo Error: Docker is not installed or is not on PATH. Install Docker Desktop.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo Error: Docker Compose is unavailable. Install or update Docker Desktop.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo Error: Docker Desktop is installed, but its engine is not running.
  echo Start Docker Desktop and try again.
  exit /b 1
)
exit /b 0

:check_node
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Error: Node.js is not installed or is not on PATH.
  echo Install Node.js 24 or newer from https://nodejs.org/.
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Error: npm is not installed or is not on PATH.
  echo Install Node.js 24 or newer from https://nodejs.org/.
  exit /b 1
)

set "NODE_MAJOR="
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo Error: unable to determine the installed Node.js version.
  exit /b 1
)
if %NODE_MAJOR% LSS 24 (
  echo Error: Node.js 24 or newer is required. Found major version %NODE_MAJOR%.
  exit /b 1
)
exit /b 0

:initialize_app
call :check_node || exit /b 1

if not exist ".env" (
  if not exist ".env.dev.example" (
    echo Error: .env.dev.example was not found.
    exit /b 1
  )

  echo Creating .env from .env.dev.example...
  copy /y ".env.dev.example" ".env" >nul || exit /b 1
  node -e "const fs=require('fs'),crypto=require('crypto'),p='.env';let s=fs.readFileSync(p,'utf8');s=s.replace(/^APP_KEY=.*$/m,'APP_KEY='+crypto.randomBytes(32).toString('base64'));fs.writeFileSync(p,s)" || exit /b 1
  echo Created .env with a generated development APP_KEY.
)

if not exist "node_modules" (
  echo Installing npm dependencies...
  call npm.cmd install || exit /b 1
)
exit /b 0

:start_infrastructure
echo Starting PostgreSQL, Redis, MinIO, and InfluxDB...
docker compose -f "%COMPOSE_FILE%" up -d --wait postgres redis minio influxdb || exit /b 1

echo Ensuring the MinIO development bucket exists...
docker compose -f "%COMPOSE_FILE%" run --rm --no-deps createbuckets || exit /b 1
exit /b 0

:start_app
echo Starting the AdonisJS and Vite development servers...
echo Press Ctrl+C to stop the app. Development containers will keep running.
call npm.cmd run dev
exit /b %ERRORLEVEL%
