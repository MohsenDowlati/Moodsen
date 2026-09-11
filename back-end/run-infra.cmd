@echo off
REM Start ONLY the infrastructure (MariaDB, Adminer, Zookeeper, Kafka, Redis)
REM in Docker. The API and worker run locally (see run-api.cmd / run-worker.cmd).
cd /d "%~dp0"
docker compose up -d
