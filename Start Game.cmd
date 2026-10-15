@echo off
cd /d "%~dp0"
title Mars Sweet Heist
node tools/serve.mjs --open
if errorlevel 1 pause
