# Road_safety_ (AccelerateZero)

AccelerateZero is a FastAPI and static web application for road hazard reporting, emergency response coordination, civic dashboards, and AI-assisted road safety workflows.

## Stack

- Python 3.11+
- FastAPI, Uvicorn, Gunicorn
- Supabase Auth and Postgres
- Vanilla HTML, CSS, and JavaScript frontend served by FastAPI
- Ollama-compatible AI endpoint over HTTP

## Project Structure

```text
src/
  backend/
    api/              HTTP routes, dependencies, middleware, websockets
    application/      DTOs and use cases
    core/             settings and shared constants
    domain/           domain exceptions
    infrastructure/   Supabase, storage, AI, and background task adapters
    main.py           FastAPI application factory
  frontend/
    images/           production UI assets
    pages/            static application pages
    scripts/          browser-side modules
    styles/           shared stylesheet
supabase/
  migrations/         database migration history
```

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill in `.env` with Supabase, database, and AI provider values. Keep `.env` local only.

## Run Locally

```powershell
uvicorn src.backend.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`.

## Production

```powershell
gunicorn src.backend.main:app --worker-class uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000
```

Set `APP_ENV=production`, provide a strong `SECRET_KEY`, configure explicit CORS origins, and deploy with environment-managed secrets.

## Database

Apply Supabase migrations in timestamp order from `supabase/migrations`. Do not edit migrations that have already been applied to a shared environment; add a new migration for schema changes.

## Security Notes

- Never commit `.env` or Supabase service-role keys.
- The frontend reads public runtime configuration from `/api/v1/config/public`.
- API docs are disabled automatically when `APP_ENV=production`.
- Uploaded media is stored under `uploads/`, which is intentionally ignored by Git.
