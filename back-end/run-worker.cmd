@echo off
REM Run the notification worker locally. This process owns the APScheduler
REM (daily reminders) and the Kafka consumers (notification + leaderboard).
REM Run it in a second terminal, alongside run-api.cmd.
cd /d "%~dp0"
venv\Scripts\python.exe -m app.workers.notification_worker
