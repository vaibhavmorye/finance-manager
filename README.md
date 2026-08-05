# Finance Manager

Privacy-focused personal finance tracker. Track income, investments, home loans, insurance, and expenses — plus FIRE, SIP, and home-loan calculators.

## Branches

| Branch | What you get |
|--------|----------------|
| `main` | **Frontend-only** — data stays in the browser (`localStorage`) with JSON export/import. No login. |
| `fullstack` | Adds Node.js + TypeScript API, MySQL, JWT auth, Docker. |

## Quick start (frontend-only)

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
npm test        # unit tests for EMI / FIRE / SIP
npm run build   # production build
```

## Features

- Dashboard: net worth, cash flow, asset allocation, FIRE progress
- Income, investments (stocks / MF / FD), debts & home loans, expenses, health insurance
- Home loan calculator with rate changes, amortization schedule, monthly/weekly prepayment planner
- FIRE & SIP calculators
- Light / dark theme, INR (lakh/crore) formatting
- Export / import JSON backup; reset data

## Tech

React 19 · Vite · TypeScript · Tailwind CSS v4 · Zustand · Recharts · Zod · Vitest

## Docker (static frontend)

```bash
docker compose up --build
```

Serves the built app on http://localhost:8080
