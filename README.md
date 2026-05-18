# Bank Management System

Full-stack TypeScript monorepo for a multi-tenant bank management system.

## Apps and packages

- `apps/web`: Next.js App Router UI with landing, auth, role-based shell, dashboards, KYC, transfers, loans, reports, audit, and admin pages.
- `apps/api`: Fastify API with auth, RBAC, tenant scoping, accounts, ledger-backed transactions, KYC, loans, notifications, reports, and audit endpoints.
- `packages/shared`: domain constants, Zod DTOs, seeded demo data, and shared types.
- `packages/auth`: JWT, password hashing, and RBAC policy helpers.
- `packages/db`: Prisma schema and seed script for Postgres.
- `infra`: Docker Compose for Postgres and Redis.

## Setup

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev:api
npm run dev:web
```

Credentials and provider keys are intentionally read from `.env`; no secrets are committed.

## Demo logins

The UI includes role selectors on the sign-in screen. Use these seeded identities once the database is connected:

- `platform@bancuip.test`
- `admin@meridian.test`
- `manager@meridian.test`
- `teller@meridian.test`
- `loan@meridian.test`
- `auditor@meridian.test`
- `customer@meridian.test`

Default seeded password: `Password123!`
