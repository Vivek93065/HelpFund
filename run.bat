@echo off
REM =========================================================================
REM HelpFund Project Runner
REM Automatically binds the portable Node.js 22 LTS runtime for this workspace.
REM 
REM Usage:
REM   .\run.bat <npm-command>
REM Examples:
REM   .\run.bat run init-db
REM   .\run.bat run test-db
REM   .\run.bat dev
REM =========================================================================

set "PATH=%LOCALAPPDATA%\Programs\node-v22.23.4-win-x64;%PATH%"
npm %*
