# SOAR Hub

Scholarship application support for young Nigerians — discovery of verified, fully funded undergraduate
scholarships, explainable eligibility checks, deadline planning, a secure document workspace, essay support
with human-approved AI critique, referee management, and full admin/reviewer tooling.

> SOAR Hub supports preparation. It never guarantees admission, selection or an award.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS v4, hand-built accessible components (shadcn-style, Radix primitives), Lucide, Recharts |
| Forms/validation | Zod on every server boundary; React Hook Form on registration |
| Database | PostgreSQL 16 + pgvector (Supabase recommended), Drizzle ORM + SQL migrations |
| Auth | Built-in: scrypt password hashing, DB-backed sessions (30-min idle expiry), email verification, reset tokens, RBAC |
| Files | Private S3-compatible storage (Supabase Storage / AWS S3 / R2) with short-lived signed URLs |
| Email / SMS | Resend or SendGrid; Africa's Talking |
| AI | Anthropic Claude (default `claude-opus-5-5`) or OpenAI, structured output, mandatory human approval |
| Jobs | Vercel Cron → `/api/cron/*`, or `npm run worker` on any host |
| Tests | Vitest (unit + PostgreSQL integration), Playwright + axe-core (E2E, accessibility, 320px mobile) |

## Quick start (local)

```bash
npm install
cp .env.example .env          # defaults work for local dev
```

Create the database user and databases the default `.env` expects (Ubuntu/Debian with a local PostgreSQL 16):

```bash
sudo apt install postgresql-16-pgvector          # pgvector extension (match your PostgreSQL major version)
sudo -u postgres psql -c "CREATE USER soar WITH PASSWORD 'soar' SUPERUSER;"
sudo -u postgres createdb -O soar soar_hub
sudo -u postgres createdb -O soar soar_hub_test   # only needed for `npm test`
```

Or run PostgreSQL with pgvector in Docker instead:
`docker run -d -p 5432:5432 -e POSTGRES_USER=soar -e POSTGRES_PASSWORD=soar -e POSTGRES_DB=soar_hub pgvector/pgvector:pg16`

Then:

```bash
npm run db:migrate
npm run db:seed:demo          # base data + clearly-labelled DEMO users/scholarships
npm run demo:setup               # all-in-one for demos: migrate + demo accounts + scholarships + resources (see docs/DEMO_SCRIPT.md)
npm run db:import-scholarships   # the 35 Mastercard Foundation partner opportunities (archives the demo scholarships)
npm run db:import-resources      # learning resources: SOP sample, CV template, recommendation letter sample (with explanations)
npm run logos:fetch              # optional, needs internet: download each school's logo into public/logos
npm run dev                   # http://localhost:3000  (check http://localhost:3000/api/health)
```

Demo accounts (local only, password `Soar-demo-2026!` or `$DEMO_PASSWORD`):
`applicant@demo.soarhub.ng`, `reviewer@demo.soarhub.ng`, `admin@demo.soarhub.ng`, `superadmin@demo.soarhub.ng`.
In development, emails are written to `.dev-storage/outbox.jsonl` (open verification/reset/referee links from there).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run db:migrate` | Apply SQL migrations (`drizzle/`) |
| `npm run db:seed` | Idempotent base data (roles, permissions, templates, default rubric & milestones) — safe in production |
| `npm run db:seed:demo` | Base + demo data (refused in production) |
| `npm run db:import-scholarships` | Load/refresh the 35 Mastercard Foundation partner scholarships (`src/lib/data/mcf-scholarships.ts`, snapshot of 24 Nov 2026). `-- --keep-demo` keeps demo scholarships active |
| `npm run logos:fetch` | Download each partner school's icon/logo from its official website into `public/logos/` (re-encoded to 256×256 PNG), record it in `src/lib/data/school-logos.json` and set it on the scholarships. Schools without a logo show an initials badge. `-- --refresh` re-downloads, `-- --no-db` skips the database |
| `npm run db:import-resources` | Load/refresh SOAR Hub's learning resources (`src/lib/data/learning-resources.ts`; files in `public/downloads`) |
| `npm run db:create-admin` | Create/promote a super administrator (`ADMIN_EMAIL=… npm run db:create-admin`) |
| `npm run worker` | Background job loop for non-Vercel hosts (`-- --once` for a single pass) |
| `npm test` | Unit + integration tests (rebuilds the test database) |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run typecheck`, `npm run lint` | Static checks |

## Documentation

- [Architecture & decisions](docs/ARCHITECTURE.md)
- [Installation](docs/INSTALLATION.md) · [Deployment](docs/DEPLOYMENT.md)
- [Admin guide](docs/ADMIN_GUIDE.md) · [Reviewer & applicant guide](docs/USER_GUIDE.md)
- [API & routes](docs/API.md) · [Security & privacy](docs/SECURITY.md)
- [Testing & test report](docs/TESTING.md)
- [Implementation checklist & known limitations](docs/CHECKLIST.md)
