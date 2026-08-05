# Finance Manager

Privacy-focused personal finance tracker. Track income, investments, home loans, insurance, and expenses — plus FIRE, SIP, and home-loan calculators.

## Branches

| Branch | What you get |
|--------|----------------|
| `main` | **Frontend-only** — data stays in the browser (`localStorage`) with JSON export/import. No login. |
| `fullstack` | Adds Node.js + TypeScript API, MySQL, JWT auth, Docker. |

## Quick start — frontend-only (`main`)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

- **Start as new user** — guided onboarding
- **Import my data** — load a previous JSON backup
- Or open **Calculators** without setup

```bash
npm test
npm run build
docker compose up --build   # static nginx on :8080 (no API)
```

## Quick start — fullstack (`fullstack`)

```bash
# Dev (hot reload) — MySQL + API + Vite
docker compose -f docker-compose.dev.yml up --build

# Or run services locally:
# 1) Start MySQL (or use compose for mysql only)
# 2) Backend
cd backend && cp .env.example .env && npm install && npx prisma generate && npx prisma db push && npm run dev
# 3) Frontend
cd frontend && cp .env.example .env && npm install && npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:4000/health  
- Production-style stack: `docker compose up --build` → app on :8080, API on :4000

Sign up with email/password; data syncs to MySQL. JSON export/import still works.

## Features

- Dashboard: net worth, cash flow, asset allocation, FIRE progress
- Income, investments (stocks / MF / FD), debts & home loans, expenses, health insurance
- Home loan calculator with rate changes, amortization, monthly/weekly prepayment planner
- FIRE & SIP calculators
- Light / dark theme, INR (lakh/crore) formatting

## Tech

**Frontend:** React · Vite · TypeScript · Tailwind CSS v4 · Zustand · Recharts · Zod · Vitest  

**Backend (fullstack):** Express · Prisma · MySQL 8 · JWT · bcrypt · Docker Compose
