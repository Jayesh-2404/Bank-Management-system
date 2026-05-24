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

Enable demo authentication with these values in `.env`:

```bash
DEMO_AUTH_ENABLED="true"
DEMO_AUTH_PASSWORD="Password123!"
```

When demo auth is enabled, the API accepts only these hardcoded demo identities and the demo password, then loads the matching seeded user from the database so each role keeps its normal bank, branch, customer, and permission scope.

| Role | Login type | Identifier | Password |
| --- | --- | --- | --- |
| Platform Admin | `STAFF` | `platform@bancuip.test` | `Password123!` |
| Bank Admin | `STAFF` | `admin@meridian.test` | `Password123!` |
| Branch Manager | `STAFF` | `manager@meridian.test` | `Password123!` |
| Teller | `STAFF` | `teller@meridian.test` | `Password123!` |
| Loan Officer | `STAFF` | `loan@meridian.test` | `Password123!` |
| Auditor | `STAFF` | `auditor@meridian.test` | `Password123!` |
| Customer | `CUSTOMER` | `customer@meridian.test` | `Password123!` |
