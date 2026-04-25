@echo off
REM Production Deployment Script for Windows
REM Sets up and starts the application in production mode
REM Usage: deploy.bat

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo ^|  PRODUCTION DEPLOYMENT SCRIPT          ^|
echo ==========================================
echo.

REM Configuration
set NODE_ENV=production
if "%PORT%"=="" set PORT=5000
set INSTALL_DEPS=true
set RUN_TESTS=true
set CLEANUP=true

cd /d "%~dp0\.."

echo Current directory: !CD!
echo.

REM Step 1: Check Node.js installation
echo [STEP 1] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] Node.js %NODE_VERSION%
echo [OK] npm %NPM_VERSION%
echo.

REM Step 2: Clean up unused files
if "%CLEANUP%"=="true" (
    echo [STEP 2] Cleaning up unused files...
    node scripts\cleanup.js
    echo.
)

REM Step 3: Install dependencies
if "%INSTALL_DEPS%"=="true" (
    echo [STEP 3] Installing dependencies...
    call npm install --production
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        exit /b 1
    )
    echo [OK] Dependencies installed
    echo.
)

REM Step 4: Check environment configuration
echo [STEP 4] Checking environment configuration...
if not exist ".env.production" (
    echo [ERROR] .env.production file not found
    echo [WARNING] Please copy .env.example to .env.production and configure it
    exit /b 1
)
echo [OK] .env.production file found
echo.

REM Step 5: Run tests
if "%RUN_TESTS%"=="true" (
    echo [STEP 5] Running comprehensive tests...
    node backend\tests\runTests.js
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Tests failed
        exit /b 1
    )
    echo [OK] All tests passed
    echo.
)

REM Step 6: Start the server
echo [STEP 6] Starting the server...
echo Environment: %NODE_ENV%
echo Port: %PORT%
echo.

set NODE_ENV=production
cd backend
node index.js

echo.
echo ==========================================
echo ^|  Deployment complete!                   ^|
echo ==========================================
echo.

endlocal
