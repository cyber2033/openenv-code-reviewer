@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "MODE=all"
set "OPEN_BROWSER=1"

:parse_args
if "%~1"=="" goto after_args
if /I "%~1"=="backend-only" set "MODE=backend"
if /I "%~1"=="check" set "MODE=check"
if /I "%~1"=="no-open" set "OPEN_BROWSER=0"
shift
goto parse_args

:after_args
set "ROOT=%cd%"
set "API_DIR=%ROOT%\code-review-env"
set "WEB_DIR=%ROOT%\dashboard"
set "VENV_DIR=%ROOT%\.venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "BACKEND_PORT=7860"
set "FRONTEND_PORT=5173"
set "BACKEND_URL=http://127.0.0.1:%BACKEND_PORT%/dashboard"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%"

call :ensure_python
if errorlevel 1 exit /b 1

call :ensure_venv
if errorlevel 1 exit /b 1

call :ensure_python_deps
if errorlevel 1 exit /b 1

call :refresh_dataset
if errorlevel 1 exit /b 1

if /I "%MODE%"=="check" (
    call :ensure_npm
    if errorlevel 1 exit /b 1

    call :ensure_node_deps
    if errorlevel 1 exit /b 1

    echo.
    echo Environment check passed.
    echo Backend URL:  %BACKEND_URL%
    echo Frontend URL: %FRONTEND_URL%
    exit /b 0
)

call :write_port_file
if errorlevel 1 exit /b 1

call :start_backend
if errorlevel 1 exit /b 1

if /I "%MODE%"=="all" (
    call :ensure_npm
    if errorlevel 1 exit /b 1

    call :ensure_node_deps
    if errorlevel 1 exit /b 1

    call :start_frontend
    if errorlevel 1 exit /b 1
)

if "%OPEN_BROWSER%"=="1" (
    timeout /t 3 /nobreak >nul
    start "" "%BACKEND_URL%"
    if /I "%MODE%"=="all" start "" "%FRONTEND_URL%"
)

echo.
if /I "%MODE%"=="all" (
    echo Backend:  %BACKEND_URL%
    echo Frontend: %FRONTEND_URL%
) else (
    echo Backend:  %BACKEND_URL%
)
echo Logs are running in the new terminal windows.
exit /b 0

:ensure_python
set "BOOTSTRAP_PY="
where py >nul 2>nul
if not errorlevel 1 (
    py -3.14 -c "import sys" >nul 2>nul && set "BOOTSTRAP_PY=py -3.14"
    if not defined BOOTSTRAP_PY py -3.12 -c "import sys" >nul 2>nul && set "BOOTSTRAP_PY=py -3.12"
    if not defined BOOTSTRAP_PY py -3.11 -c "import sys" >nul 2>nul && set "BOOTSTRAP_PY=py -3.11"
)

if defined BOOTSTRAP_PY exit /b 0

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found on PATH.
    exit /b 1
)

set "BOOTSTRAP_PY=python"
exit /b 0

:ensure_venv
if exist "%VENV_PY%" exit /b 0

echo [INFO] Creating virtual environment...
call %BOOTSTRAP_PY% -m venv "%VENV_DIR%"
if errorlevel 1 (
    echo [ERROR] Failed to create the virtual environment.
    exit /b 1
)

if not exist "%VENV_PY%" (
    echo [ERROR] Virtual environment creation did not produce python.exe.
    exit /b 1
)
exit /b 0

:ensure_python_deps
"%VENV_PY%" -c "import fastapi, uvicorn, pydantic, httpx, openai" >nul 2>nul
if not errorlevel 1 exit /b 0

echo [INFO] Installing Python dependencies...
"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip.
    exit /b 1
)

"%VENV_PY%" -m pip install -r "%ROOT%\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    exit /b 1
)
exit /b 0

:refresh_dataset
echo [INFO] Refreshing task datasets...
pushd "%API_DIR%" >nul
if errorlevel 1 (
    echo [ERROR] Could not open %API_DIR%.
    exit /b 1
)

"%VENV_PY%" dump_json.py
set "STEP_ERROR=%ERRORLEVEL%"
popd >nul

if not "%STEP_ERROR%"=="0" (
    echo [ERROR] Dataset refresh failed.
    exit /b %STEP_ERROR%
)
exit /b 0

:ensure_npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found on PATH.
    exit /b 1
)
exit /b 0

:ensure_node_deps
if exist "%WEB_DIR%\node_modules" exit /b 0

echo [INFO] Installing dashboard dependencies...
pushd "%WEB_DIR%" >nul
if errorlevel 1 (
    echo [ERROR] Could not open %WEB_DIR%.
    exit /b 1
)

if exist package-lock.json (
    call npm ci
) else (
    call npm install
)

set "STEP_ERROR=%ERRORLEVEL%"
popd >nul

if not "%STEP_ERROR%"=="0" (
    echo [ERROR] Dashboard dependency install failed.
    exit /b %STEP_ERROR%
)
exit /b 0

:write_port_file
> "%API_DIR%\.port" echo %BACKEND_PORT%
if errorlevel 1 (
    echo [ERROR] Could not write the backend port file.
    exit /b 1
)
exit /b 0

:start_backend
echo [INFO] Starting backend on port %BACKEND_PORT%...
start "OpenEnv Backend" cmd /k "cd /d ""%API_DIR%"" && echo Backend running at %BACKEND_URL% && ""%VENV_PY%"" -m uvicorn server.main:app --host 127.0.0.1 --port %BACKEND_PORT%"
if errorlevel 1 (
    echo [ERROR] Failed to launch the backend terminal.
    exit /b 1
)
exit /b 0

:start_frontend
echo [INFO] Starting frontend on port %FRONTEND_PORT%...
start "OpenEnv Frontend" cmd /k "cd /d ""%WEB_DIR%"" && echo Frontend running at %FRONTEND_URL% && npm run dev -- --host 127.0.0.1 --port %FRONTEND_PORT%"
if errorlevel 1 (
    echo [ERROR] Failed to launch the frontend terminal.
    exit /b 1
)
exit /b 0
