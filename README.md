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

## Authentication

The API authenticates real database users with Argon2 password hashes and returns a signed JWT access token. Protected API requests must send the token in the `Authorization` header:

```http
Authorization: Bearer <access-token>
```

Users are provisioned through controlled staff/admin flows or seed data. Public self-service signup is not enabled.

For local development, seed data creates initial users with hashed passwords. Use those provisioned credentials on the sign-in page instead of enabling demo-only authentication.
