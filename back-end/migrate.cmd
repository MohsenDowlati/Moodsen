@echo off
REM Apply database migrations against the dockerized MariaDB.
REM Optional: the API also creates tables on startup, but this keeps the
REM schema managed the same way it is in production.
cd /d "%~dp0"
venv\Scripts\python.exe -m alembic upgrade head
