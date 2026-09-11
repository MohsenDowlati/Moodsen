# Running Moodsen locally (Windows)

Local dev is **hybrid**: the infrastructure (MariaDB, Kafka, Redis) runs in
Docker, while the **API and front-end run natively** so you get live reload.
The Docker files are kept — you can still run the whole stack in containers.

## Prerequisites

- **Docker Desktop** (for MariaDB + Kafka + Redis)
- **Python 3.13** (a virtualenv already exists at `back-end/venv`)
- **Node.js 18+** (for the Next.js front-end)

## 1. Start the infrastructure (Docker)

```powershell
cd back-end
docker compose up -d          # or: .\run-infra.cmd
```

This starts **infra only** — `db`, `adminer`, `zookeeper`, `kafka`, `redis`.
The ports are published to `127.0.0.1`, and `back-end/.env` already points the
app at them (`localhost:9092`, `redis://localhost:6379`, DB on `127.0.0.1:3306`).

- Adminer (DB UI): http://localhost:8080  (server `db`, user/password from `.env`)

## 2. Back-end (FastAPI) — two terminals

First-time only, install dependencies:

```powershell
cd back-end
venv\Scripts\python.exe -m pip install -r requirements.txt
```

**Terminal A — API** (auto-creates tables on startup; `migrate.cmd` is optional):

```powershell
cd back-end
.\run-api.cmd                 # uvicorn app.main:app --reload on http://localhost:8000
```

**Terminal B — notification worker** (daily reminders + Kafka consumers):

```powershell
cd back-end
.\run-worker.cmd
```

- API docs: http://localhost:8000/docs
- Health:   http://localhost:8000/health

## 3. Front-end (Next.js)

```powershell
cd front-end
npm install                   # first time only
npm run dev                   # http://localhost:3000
```

`front-end/.env.local` points the UI at `http://localhost:8000`.

## Running the back-end tests

Tests use in-memory SQLite with Kafka disabled — **no infra required**:

```powershell
cd back-end
venv\Scripts\python.exe -m pytest -q
```

## Optional: run everything in Docker

The full-stack containers are preserved behind the `apps` profile:

```powershell
cd back-end
docker compose --profile apps up --build
```
