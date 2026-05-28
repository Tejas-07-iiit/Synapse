# Copilot instructions

## Commands
- `npm run dev` starts the Next.js dev server (turbopack).
- `npm run build` builds the production bundle.
- `npm run start` runs the production server.
- `npm run lint` runs ESLint.

## High-level architecture
- **Next.js App Router**: UI pages live in `app/`, API routes in `app/api/*` (auth, positions, settings, wallet, signals).
- **Data layer**: Prisma + PostgreSQL (`prisma/schema.prisma`, client in `lib/prisma.ts`).
- **Market pipeline**: `src/market-engine/market-engine.ts` fetches historical candles from Binance REST (`services/market/candles.ts`), subscribes to WebSocket streams, updates Zustand stores, and recalculates on candle close.
- **Strategy engine**: `src/strategy-engine/core/engine.ts` calculates indicators, classifies market regime, runs strategies from `src/strategy-engine/strategies/*`, prioritizes signals, and logs to `/api/signals`.
- **Execution engine (paper)**: `src/execution-engine/paper` manages virtual positions and persists via `/api/positions`, using settings and wallet Zustand stores.

## Key conventions
- JWT is stored in the httpOnly `token` cookie; `/api/auth/*` handles login/registration, and `middleware.ts` protects internal pages.
- Prisma client is a singleton via `globalThis` (see `lib/prisma.ts`).
- API routes and stores often fall back to `default-user-id`; `services/user/userService.ts` ensures a default user, wallet, and settings exist.
- Strategies are registered once via `initializeStrategies()`; add a new strategy under `src/strategy-engine/strategies/` and export/register it in `index.ts`.
- Indicators are centralized in `src/strategy-engine/indicators`; `services/indicators` only proxies to that engine.
- Zustand stores are split: domain stores in `src/stores/*`, auth in `store/useAuthStore.ts`.

## Environment
- `.env` expects `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPPORTED_COINS`, `NEXT_PUBLIC_AUTONOMOUS_TRADING` (see `.env.example`).
