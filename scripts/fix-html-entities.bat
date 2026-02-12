@echo off
REM scripts\fix-html-entities.bat
REM Doble click para corregir &amp;&amp;, &lt;Link, etc. en el proyecto.
powershell -ExecutionPolicy Bypass -File "%~dp0fix-html-entities.ps1"
pause
