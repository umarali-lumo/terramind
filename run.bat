@echo off
setlocal EnableExtensions

title TerraMind v2

cd /d "%~dp0"

echo.
echo ============================================================
echo                  TERRAMIND v2  -  STARTUP
echo ============================================================
echo.

REM ============================================================
REM 1. PYTHON + VIRTUAL ENVIRONMENT
REM ============================================================

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON=py"
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Python was not found. Install Python 3.10+ from python.org
        echo.
        pause
        exit /b 1
    )
    set "PYTHON=python"
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    echo.
    %PYTHON% -m venv .venv
    if errorlevel 1 (
        echo ERROR: Could not create the virtual environment.
        pause
        exit /b 1
    )
)

set "VENV_PY=%~dp0.venv\Scripts\python.exe"

echo Installing backend dependencies (skips if already installed)...
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Backend dependency installation failed.
    pause
    exit /b 1
)

REM ============================================================
REM 2. SEED DEMO DATA (first run only)
REM ============================================================

if not exist "backend\terramind.db" (
    echo.
    echo Seeding demo farm - Green Valley Farm...
    "%VENV_PY%" backend\app\seed.py
    if errorlevel 1 (
        echo ERROR: Seeding failed.
        pause
        exit /b 1
    )
)

REM ============================================================
REM 3. FRONTEND (Next.js dev server, port 3000)
REM ============================================================

where npm >nul 2>nul
if errorlevel 1 (
    if exist "C:\Program Files\nodejs\npm.cmd" (
        set "PATH=%PATH%;C:\Program Files\nodejs"
    ) else (
        echo WARNING: Node.js not found - starting backend only.
        echo          Install Node.js LTS 20+ from nodejs.org for the frontend.
        goto start_backend
    )
)

if not exist "frontend\node_modules" (
    echo.
    echo Installing frontend dependencies - first run only, may take a few minutes...
    pushd frontend
    call npm install
    popd
)

echo.
echo Starting frontend on http://127.0.0.1:3000 ...
pushd frontend
start "TerraMind Frontend" cmd /k "npm run dev"
popd

:start_backend

REM ============================================================
REM 4. BACKEND (FastAPI + disease model, port 8000)
REM ============================================================

echo Starting backend on http://127.0.0.1:8000 ...
start "TerraMind Backend" cmd /k ""%VENV_PY%" backend\main.py"

REM ============================================================
REM 5. OPEN BROWSER
REM ============================================================

timeout /t 10 /nobreak >nul
start http://127.0.0.1:3000

echo.
echo ============================================================
echo  TerraMind v2 is running.
echo.
echo  Frontend : http://127.0.0.1:3000
echo  Backend  : http://127.0.0.1:8000   (API docs: /api/docs)
echo  Demo login: demo@terramind.ai / terramind123
echo.
echo  Two windows were opened (Backend + Frontend).
echo  Close both windows to stop TerraMind.
echo ============================================================
echo.

pause
