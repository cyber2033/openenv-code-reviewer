@echo off
REM ============================================================
REM  update_all.bat
REM  One command to commit, push to GitHub, AND deploy to HF
REM  Usage: .\update_all.bat "your commit message"
REM ============================================================

SET MSG=%~1
IF "%MSG%"=="" SET MSG=update: code improvements and fixes

echo.
echo ============================================================
echo  STEP 1: Git - Stage, Commit, Push
echo ============================================================
git add -A
git commit -m "%MSG%"
git push origin main

IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git push failed. Stopping.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  STEP 2: HuggingFace - Build and Deploy
echo ============================================================
python deploy_to_hf.py

echo.
echo ============================================================
echo  ALL DONE!
echo  GitHub : https://github.com/cyber2033/openenv-code-reviewer
echo  HF App : https://receptionistprotactiniumsoft-openenv-code-reviewer.hf.space
echo ============================================================
pause
