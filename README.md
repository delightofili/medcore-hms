# MedCore HMS

A multi-tenant Hospital Management System designed to
support hospital administration and clinical workflows.

**Project:** Internmo Full Stack Development Internship  
**Status:** In development  
**Developer:** Chukwunonso Ofili

## Project objectives

- Hospital onboarding and administration
- Authentication and role-based access control
- Patient registration and appointment scheduling
- Electronic medical records and prescriptions
- Laboratory and pharmacy workflows
- Billing and payment tracking
- Notifications and role-specific dashboards

## Technology stack

- Next.js 15, React 19, TypeScript
- NestJS
- Prisma ORM
- PostgreSQL 16
- Redis 7
- Docker Compose
- pnpm 9.15.9

## Repository structure

```text
medcore-hms/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   └── types/        # Shared TypeScript contracts
├── docs/
│   ├── architecture.md
│   └── decisions/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Prerequisites

- Node.js 22
- pnpm 9.15.9
- Git
- Docker Desktop with Docker Compose

## Local setup

1. Clone the repository.
2. Install the pinned pnpm version.
3. Copy `.env.example` to `.env`.
4. Review and change the local development passwords.
5. Install workspace dependencies.
6. Start the infrastructure.

```powershell
pnpm install
pnpm infra:up
pnpm infra:status
```

Check the database:

```powershell
docker compose exec postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT 1"'
```

Check Redis:

```powershell
docker compose exec redis sh -lc 'redis-cli -a "$REDIS_PASSWORD" ping'
```

Create the initial database migration and open Prisma Studio:

```powershell
pnpm exec prisma migrate dev --schema apps/api/prisma/schema.prisma --name init
pnpm exec prisma studio --schema apps/api/prisma/schema.prisma
```

Run these Prisma commands from the repository root so Prisma loads the root `.env`.

## Environment configuration

The `.env.example` file documents the required variables.
The actual `.env` file must never be committed.

Do not use local development credentials in production.

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Development status

- [x] Initial monorepo structure
- [x] Docker Compose configuration
- [x] PostgreSQL and Redis development services
- [x] Initial architecture documentation
- [ ] Prisma schema and migrations
- [ ] Authentication and authorization
- [ ] Hospital onboarding
- [ ] Patient and appointment workflows
- [ ] Medical records and prescriptions
- [ ] Laboratory, pharmacy, and billing
- [ ] Automated tests and deployment

## Security and demo data

This is a learning project. Use invented data only.
It is not a certified medical product and must not be
used for real patient care.

## License

No open-source license has been selected yet.
