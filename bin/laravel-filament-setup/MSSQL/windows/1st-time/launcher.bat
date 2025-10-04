@ECHO OFF
REM Fail batch ini akan memanggil skrip PowerShell deploy.ps1
REM dengan memintas Execution Policy untuk sesi ini sahaja.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0\deploy.ps1"

PAUSE