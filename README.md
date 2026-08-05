# Finance Manager

Personal finance tracker with income, investments, home loans, insurance, expenses, and FIRE / SIP / loan calculators.

One codebase. Storage is chosen with a **build-time flag** — no separate branches.

| Mode | Flag | Behavior |
|------|------|----------|
| **Local** (default) | `VITE_STORAGE_MODE=local` | Browser `localStorage`, JSON export/import, no login |
| **API** | `VITE_STORAGE_MODE=api` + `VITE_API_URL=…` | JWT signup/login, MySQL via Express + Prisma |

## Dev launch script

```bash
chmod +x scripts/dev.sh   # once

./scripts/dev.sh           # interactive menu
./scripts/dev.sh local     # frontend only · localStorage
./scripts/dev.sh api       # MySQL (Docker) + API + Vite
./scripts/dev.sh api --docker   # everything in Docker Compose
./scripts/dev.sh stop      # stop compose services
```

- Local app: http://localhost:5173  
- API health: http://localhost:4000/health  

## Manual setup

**Local mode**

```bash
cd frontend
cp .env.example .env   # ensure VITE_STORAGE_MODE=local
npm install && npm run dev
```

**API mode**

```bash
# Terminal 1 — MySQL
docker compose -f docker-compose.dev.yml up mysql

# Terminal 2 — API
cd backend && cp .env.example .env
npm install && npx prisma generate && npx prisma db push && npm run dev

# Terminal 3 — Frontend
cd frontend
# set in .env:
#   VITE_STORAGE_MODE=api
#   VITE_API_URL=http://localhost:4000
npm install && npm run dev
```

## Production Docker

```bash
# Local-storage static site
VITE_STORAGE_MODE=local docker compose up --build frontend

# Full stack (MySQL + API + frontend)
VITE_STORAGE_MODE=api VITE_API_URL=http://localhost:4000 \
  docker compose --profile api up --build
```

App: http://localhost:8080 · API: http://localhost:4000

## Features

- Welcome: new user or import JSON (local mode) · signup/login (API mode)
- Dashboard: net worth, cash flow, allocation, FIRE progress
- Income, investments (stocks / MF / FD), debts & home loans, expenses, health insurance
- Home loan calculator: EMI, rate changes, amortization, monthly/weekly prepayment
- FIRE & SIP calculators · light/dark theme · INR lakh/crore formatting

## Tech

React · Vite · TypeScript · Tailwind CSS v4 · Zustand · Recharts · Zod · Vitest  
Express · Prisma · MySQL 8 · JWT · Docker Compose

## Tests

```bash
cd frontend && npm test && npm run build
```
