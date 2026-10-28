@echo off
rem Start the Haibara pet engine (web overlay only):
rem   1) pet-engine/server.mjs    voice + subtitle + screen + settings + trace
rem   2) pet-engine/companion.mjs session events -> expressions / low-frequency comments
rem Requires: DSH running, GPT-SoVITS API on 127.0.0.1:9881.
cd /d "%~dp0.."
start "haibara-engine" /min node "pet-engine\server.mjs"
start "haibara-companion" /min node "pet-engine\companion.mjs"
echo Started. Close the console windows to stop.
pause
