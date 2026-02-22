# TyoTrack (Full-Stack)

TyoTrack is now structured as:
- `frontend` (this root Vite app)
- `backend` (Next.js API routes + NextAuth + Prisma)
- `prisma/schema.prisma` (PostgreSQL 16 data model)
- `backend/prisma/schema.prisma` (backend-local Prisma schema used by CLI scripts)

## Stack

- Frontend: React + Vite
- Backend API: Next.js Route Handlers (`/api/*`)
- Auth: NextAuth JWT + email/password + `bcryptjs`
- DB: PostgreSQL 16 + Prisma
- Validation: Zod
- Tests: Vitest (backend integration-focused)

## Environment

Copy `.env.example` values into your environment.

Required backend variables:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ENABLE_TEST_LOGIN` (`true` enables permanent role test login)
- `TEST_LOGIN_PASSWORD` (default `password123`)

Optional frontend variables:
- `VITE_API_PROXY_TARGET` (default `http://localhost:3061`)
- `VITE_API_BASE_URL` (leave empty for proxied local dev)

## Install

```bash
npm install
npm install --prefix backend
```

## Prisma Migrations

```bash
npm run prisma:generate --prefix backend
npm run prisma:migrate --prefix backend
npm run seed --prefix backend
```

For production deploy:

```bash
npm run prisma:deploy --prefix backend
```

Permanent no-seed role test login credentials (when `ENABLE_TEST_LOGIN=true`):
- `SUPER_ADMIN` -> `super@tyo.com / password123`
- `COMPANY_ADMIN` -> `alice@acme.com / password123`
- `EMPLOYEE` -> `bob@acme.com / password123`

## Run Locally

Terminal 1 (backend API):

```bash
npm run dev:backend
```

Terminal 2 (frontend UI):

```bash
npm run dev:frontend
```

Frontend runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:3061`.

## Docker Compose (Dev)

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3061`
- PostgreSQL 16: `localhost:5433`

Useful Docker commands:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
docker compose exec backend npm run test
docker compose down
```

## Docker Compose (Production-style)

This stack serves frontend and backend on the same host and proxies `/api/*` correctly to backend.

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Key production note:
- Frontend Nginx now proxies `/api/*` -> `backend:3061` to avoid `502` from missing API upstream.
- Backend auto-bootstraps on each start:
  - `prisma migrate deploy`
  - auto-seed (`AUTO_SEED=true`, idempotent)
  - `next start`

For webhook-style deploy triggers (like `curl -X POST "http://142.91.103.245:9000/?token=SUPER_SECRET_TOKEN"`), make sure your webhook handler runs:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

That single command is now enough for pull + migrate + seed + start (no manual seed step).

## API Surface

Implemented route groups:
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/users/*`
- `/api/companies/*`
- `/api/projects/*`
- `/api/time-entries/*`
- `/api/policies/*`
- `/api/reports/*`
- `/api/audit-logs/*`

## Tests

```bash
npm run test --prefix backend
```

Included integration-focused tests for:
- Auth hashing/verification
- Time entry split logic
- Approval status derivation
- Reporting aggregation
