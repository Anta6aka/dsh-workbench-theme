@echo off
cd /d "%~dp0.."
start "" /min node "pet-engine\server.mjs"
