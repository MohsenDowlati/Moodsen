@echo off
REM Run the FastAPI app locally with live reload.
REM Requires the infra to be up (run-infra.cmd) so it can reach MariaDB/Kafka/Redis.
cd /d "%~dp0"
venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
