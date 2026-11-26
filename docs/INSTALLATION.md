# Installation (local development)

## Prerequisites
- Node.js 22+ and npm 10+
- PostgreSQL 16 with the **pgvector** extension available (`CREATE EXTENSION vector` must succeed).
  - Ubuntu/Debian: `sudo apt install postgresql-16 postgresql-16-pgvector`
  - macOS: `brew install postgresql@16 pgvector`
  - Docker: `docker run -p 5432:5432 -e POSTGRES_USER=soar -e POSTGRES_PASSWORD=soar -e POSTGRES_DB=soar_hub pgvector/pgvector:pg16`
  - Or use a free Supabase project (pgvector is preinstalled).

## Steps
```bash
# run from the root folder of this repository (the folder that contains package.json)
npm install
cp .env.example .env
# create databases (skip if using Docker/Supabase as above)
createuser -s soar && psql -c "ALTER USER soar PASSWORD 'soar'"
createdb -O soar soar_hub && createdb -O soar soar_hub_test
npm run db:migrate
npm run db:seed:demo
npm run dev
```
Open http://localhost:3000.

## Dev conveniences
- **Emails**: `EMAIL_PROVIDER=console` logs emails and appends them to `.dev-storage/outbox.jsonl`.
- **Files**: `STORAGE_DRIVER=local` stores uploads in `.dev-storage/` and serves them via short-lived signed
  `/api/dev-storage` URLs. Both are refused when `NODE_ENV=production`.
- **SMS**: `SMS_PROVIDER=console` logs SMS.
- **Jobs**: trigger from Admin → Settings → Background jobs, `npm run worker -- --once`, or
  `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/daily`.
- **AI/embeddings** are off by default; the platform works fully without them (human review, keyword search).

## Resetting
`npm run db:seed:demo` is idempotent. To start over, drop and recreate the database, then migrate and seed.
