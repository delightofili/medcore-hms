# MedCore HMS

A multi-tenant hospital management system for outpatient care. It covers the full patient journey: registration, booking, check in, consultation notes with vitals, prescriptions, pharmacy dispensing and billing. Each hospital's data is kept fully separate from every other hospital's.

Built with NestJS, Next.js, PostgreSQL and Redis as my project for the Internmo Full Stack Development Internship.

**Live demo:** https://medcore-hms.vercel.app
**API health:** https://medcore-api.onrender.com/api/health/ready
**Developer:** Chukwunonso Ofili

> The demo runs on free hosting. If nobody has used it for 15 minutes, the API sleeps and the first sign in can take up to a minute. The sign in page tells you when this is happening.

> This is a learning project. Use invented data only. It is not a certified medical product and must not be used for real patient care.

---

## Screenshots

| Dashboard                                               | Consultation                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ![Role based dashboard](docs/screenshots/dashboard.png) | ![Consultation with vitals, notes and prescription](docs/screenshots/consultation.png) |

| Appointments                                                       | Billing                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| ![Day view with status actions](docs/screenshots/appointments.png) | ![Invoice with part payment](docs/screenshots/invoice.png) |

---

## Contents

- [Try it](#try-it)
- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Engineering highlights](#engineering-highlights)
- [Architecture and deployment](#architecture-and-deployment)
- [Project structure](#project-structure)
- [Running it locally](#running-it-locally)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Testing the API](#testing-the-api)
- [Progress](#progress)
- [Security notes](#security-notes)

---

## Try it

Open the [live demo](https://medcore-hms.vercel.app) and pick a role under **Try the demo as**. Every demo account uses the password **`MedCoreDev2026!`**.

| Email                     | Role                      | Good for trying                                         |
| ------------------------- | ------------------------- | ------------------------------------------------------- |
| `reception@medcore.test`  | Receptionist              | Registering patients, booking, check in, taking payment |
| `doctor@medcore.test`     | Doctor (General Practice) | Consultations, records, prescriptions                   |
| `doctor2@medcore.test`    | Doctor (Paediatrics)      | A second schedule to book against                       |
| `nurse@medcore.test`      | Nurse                     | Read only clinical view                                 |
| `pharmacist@medcore.test` | Pharmacist                | Dispensing from the pharmacy queue                      |
| `accountant@medcore.test` | Accountant                | Invoices and payments                                   |
| `admin@medcore.test`      | Hospital admin            | Sees every part of the hospital                         |

**A two minute tour:**

1. Sign in as the **doctor**. Two patients are already checked in. Open Chidi from the queue, start the consultation, record vitals and a diagnosis, prescribe, sign the record and complete the visit.
2. Sign in as the **pharmacist** and dispense that prescription.
3. Sign in as the **accountant**, open the overdue invoice and record a part payment.
4. Sign in as the **admin** to see every number move on the dashboard.

Both doctors work Monday to Friday, 09:00 to 17:00, in 30 minute slots.

---

## What it does

A typical visit, from the front desk to the cashier:

1. **Reception** registers the patient and books them into one of the doctor's open slots.
2. On arrival, reception **checks the patient in**.
3. The **doctor** starts the consultation, records vitals and notes, writes a prescription and **signs** the record. Signed records are locked.
4. The prescription is **issued** to the pharmacy, which marks it **dispensed**.
5. **Billing** raises an invoice, issues it and records full or part payments until it is paid.

### Features

**Dashboard**

- One endpoint, different sections per role: a doctor sees their own queue and unsigned notes, an accountant sees revenue and outstanding balances, an admin sees everything
- Live queue of the next patients, refreshed every minute while the tab is open

**Patients**

- Registration with automatic patient numbers, search by name, number, phone or email, edit and archive (soft delete)
- Allergy warning on the patient page and again during consultation
- Clinical timeline of every past consultation with its vitals and prescriptions

**Appointments**

- Weekly doctor schedules, blocked periods for leave, and open slot calculation
- Booking from open slots only, with protection against two people taking the same slot at once
- Day view with check in, start, complete, cancel (reason required) and no show

**Clinical**

- Consultation page with vitals, complaint, symptoms, diagnosis and treatment plan
- Draft and sign workflow: a record needs a diagnosis to be signed and cannot be edited afterwards
- Prescriptions with several medicines, issued to a pharmacy queue served oldest first

**Billing**

- Invoices with line items, discount and due date, drafted then issued
- Cash, card, transfer, online and insurance payments, with part payments and overpayment protection
- Double click protection on payments through idempotency keys
- Billing staff find patients through an identity only lookup and never see medical files

---

## Tech stack

| Layer                | Technology                                                    |
| -------------------- | ------------------------------------------------------------- |
| Frontend             | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Forms                | React Hook Form, Zod                                          |
| Backend              | NestJS, TypeScript, class-validator                           |
| Database             | PostgreSQL with Prisma ORM 6                                  |
| Sessions             | Redis compatible store for refresh tokens                     |
| Auth                 | JWT access tokens, rotating refresh tokens, bcrypt            |
| Hosting              | Vercel (web), Render (API and Key Value), Neon (Postgres)     |
| Local infrastructure | Docker Compose, pnpm workspaces                               |

---

## Engineering highlights

The parts of this project I'd point a reviewer to first.

**No double booking.** Booking runs inside a `SERIALIZABLE` Postgres transaction that checks the doctor's schedule, leave and overlapping appointments before inserting. If two receptionists book the same slot at the same instant, Postgres rejects one and the user gets a clear "this slot was just booked" message instead of a silent clash. The same approach stops two cashiers paying off the same balance twice.
→ `apps/api/src/appointments/appointments.service.ts`

**State machines for every workflow.** Appointments, prescriptions and invoices each have an explicit table of allowed transitions. Status updates match on the current status, so if two people change the same record at once, the second gets a conflict instead of overwriting the first.

**Exact money maths.** Billing uses `Prisma.Decimal`, never JavaScript numbers (`0.1 + 0.2` is `0.30000000000000004` in JavaScript). Totals, balances and overdue flags are calculated on the server only. The invoice form's live preview counts in kobo, whole numbers, and the server recalculates on save.
→ `apps/api/src/billing/billing.service.ts`

**Idempotent payments.** The payment dialog creates one key when it opens. A double click or a retry sends the same key, and the server returns the existing payment instead of charging again.

**Role based data, not just role based screens.** The dashboard endpoint only computes the sections a role may see, and billing staff look patients up through an endpoint that selects identity fields only. Access rules live on the server; the UI only reflects them.
→ `apps/api/src/dashboard/dashboard.service.ts`

**Tenant isolation.** Every hospital scoped route checks membership before any query, and every query filters by `hospitalId`. Records from another hospital, or another doctor's appointments, return `404` rather than `403`, so the API never confirms they exist.
→ `apps/api/src/auth/tenant-access.service.ts`

**Clinical safety rules on the server.** Only doctors write records. A record can only be attached to a consultation that has started. A prescription takes its patient and doctor from the medical record, never from the request body. Vitals have plausibility ranges, so a temperature of 370 is rejected as a typing error.

**Token handling.** Access tokens last 15 minutes. Refresh tokens are hashed in Redis, rotated on every use and rejected if reused. The frontend refreshes silently on a `401` and shares one refresh between parallel requests, so a page firing several requests at once doesn't log the user out.
→ `apps/web/src/providers/auth-provider.tsx`

---

## Architecture and deployment

```text
            Browser
               │
               ▼
     ┌───────────────────┐
     │  Next.js on Vercel │  medcore-hms.vercel.app
     └─────────┬─────────┘
               │ HTTPS + JWT
               ▼
     ┌───────────────────┐   private network   ┌────────────────────┐
     │ NestJS on Render  │ ──────────────────▶ │ Render Key Value   │
     │ (Frankfurt)       │                     │ refresh tokens     │
     └─────────┬─────────┘                     └────────────────────┘
               │ TLS
               ▼
     ┌───────────────────┐
     │ Postgres on Neon  │  Frankfurt
     └───────────────────┘
```

Everything runs on free plans. A few choices follow from that:

- **Neon for Postgres, not Render.** Render's free Postgres is deleted after 30 days. Neon's free plan doesn't expire.
- **Everything in Frankfurt**, the closest region to Nigeria on these providers, and the same region on every service so the API talks to Redis over Render's private network.
- **`TZ=Africa/Lagos` on the API.** Slots and "today" are calculated from the server clock, and cloud servers default to UTC, which would shift every slot by an hour.
- **Migrations run during the build,** not at start up, so waking a sleeping service stays as fast as possible.
- **`/api/health` stays lightweight** (no database query), so uptime checks don't keep the database awake. `/api/health/ready` checks Postgres and Redis for real.
- **Redis data is not persistent** on the free plan. A Redis restart signs everyone out, but nothing else is lost, because refresh tokens are the only thing stored there.

---

## Project structure

```text
medcore-hms/
├── apps/
│   ├── api/                      NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma     Database schema
│   │   │   ├── migrations/       SQL migrations
│   │   │   └── seed.js           Demo hospital, staff, patients, queue and invoices
│   │   ├── src/
│   │   │   ├── auth/             Login, refresh, guards, tenant access
│   │   │   ├── hospitals/        Hospital onboarding
│   │   │   ├── departments/
│   │   │   ├── staff/            Staff accounts and doctor profiles
│   │   │   ├── patients/
│   │   │   ├── availability/     Doctor schedules and open slots
│   │   │   ├── appointments/
│   │   │   ├── clinical/         Medical records and prescriptions
│   │   │   ├── billing/          Invoices and payments
│   │   │   ├── dashboard/        Role based statistics
│   │   │   └── health/           Liveness and readiness checks
│   │   └── tests/                REST Client .http files
│   └── web/                      Next.js frontend
│       └── src/
│           ├── app/              Routes (login, dashboard, patients, appointments, billing, pharmacy, records)
│           ├── components/       UI, forms, clinical, billing and appointment components
│           ├── lib/              API client and formatting helpers
│           ├── providers/        Auth provider with token refresh
│           └── types/            Frontend types
├── docs/
│   ├── architecture.md
│   ├── decisions/                Architecture decision records
│   └── screenshots/
├── docker-compose.yml            Local PostgreSQL and Redis
└── package.json                  Workspace scripts
```

---

## Running it locally

### Prerequisites

- Node.js 22
- pnpm 9.15.9 (`npm install -g pnpm@9.15.9`)
- Docker Desktop with Docker Compose

### Setup

```bash
git clone https://github.com/delightofili/medcore-hms.git
cd medcore-hms
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Open `.env` and replace the database password, Redis password and both JWT secrets. You can generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then start the databases and load the demo data. Run these from the repository root so Prisma reads the root `.env`:

```bash
pnpm infra:up
pnpm exec prisma generate --schema apps/api/prisma/schema.prisma
pnpm exec prisma migrate deploy --schema apps/api/prisma/schema.prisma
pnpm db:seed
```

Run the API and the frontend in two terminals:

```bash
cd apps/api && pnpm dev     # http://localhost:3001/api
```

```bash
cd apps/web && pnpm dev     # http://localhost:3000
```

### Useful commands

| Command                                                          | What it does                                  |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `pnpm infra:up` / `pnpm infra:down`                              | Start or stop local PostgreSQL and Redis      |
| `pnpm infra:logs`                                                | Show recent database and Redis logs           |
| `pnpm db:seed`                                                   | Load or refresh demo data (safe to run again) |
| `pnpm exec prisma studio --schema apps/api/prisma/schema.prisma` | Browse the database                           |

### Environment variables

| Variable                                  | Where | Purpose                                                                     |
| ----------------------------------------- | ----- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                            | API   | Postgres connection string                                                  |
| `REDIS_URL`                               | API   | Redis URL. Takes priority over `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | API   | Token signing secrets, different in every environment                       |
| `CORS_ORIGIN`                             | API   | Allowed frontend origins, comma separated                                   |
| `TZ`                                      | API   | `Africa/Lagos` in production                                                |
| `NEXT_PUBLIC_API_URL`                     | Web   | API base URL. Read at build time                                            |
| `NEXT_PUBLIC_DEMO_MODE`                   | Web   | `true` shows one click demo logins                                          |

---

## Roles and permissions

Permissions are enforced in the API. The frontend only hides what a role can't use.

|                                  | Admin |  Doctor  | Nurse | Reception | Accountant | Pharmacist |
| -------------------------------- | :---: | :------: | :---: | :-------: | :--------: | :--------: |
| Register and edit patients       |   ✓   |    ✓     |   ✓   |     ✓     |            |            |
| Book and manage appointments     |   ✓   | Own only |   ✓   |     ✓     |            |            |
| Start and complete consultations |   ✓   | Own only |       |           |            |            |
| Read medical records             |   ✓   |    ✓     |   ✓   |           |            |            |
| Write and sign medical records   |       | Own only |       |           |            |            |
| Write and issue prescriptions    |       | Own only |       |           |            |            |
| View the pharmacy queue          |   ✓   |    ✓     |   ✓   |           |            |     ✓      |
| Dispense prescriptions           |   ✓   |          |       |           |            |     ✓      |
| Invoices and payments            |   ✓   |          |       |     ✓     |     ✓      |            |

---

## API reference

All routes are prefixed with `/api`. Everything except login, register, refresh and health requires a `Bearer` access token. Hospital scoped routes start with `/api/hospitals/:hospitalId`.

| Area            | Routes                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health          | `GET /health` · `GET /health/ready`                                                                                                                                                                                 |
| Auth            | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`                                                                                                            |
| Dashboard       | `GET /dashboard`                                                                                                                                                                                                    |
| Patients        | `POST /patients` · `GET /patients?q=` · `GET /patients/:id` · `PATCH /patients/:id` · `DELETE /patients/:id`                                                                                                        |
| Doctors         | `GET /doctors` · `POST /doctors/:id/availability` · `GET /doctors/available-slots?doctorId=&date=`                                                                                                                  |
| Appointments    | `POST /appointments` · `GET /appointments?date=&status=` · `GET /appointments/:id` · `PATCH /appointments/:id/status`                                                                                               |
| Medical records | `POST /medical-records` · `GET /medical-records` · `GET /medical-records/:id` · `PATCH /medical-records/:id` · `POST /medical-records/:id/sign`                                                                     |
| Prescriptions   | `POST /prescriptions` · `GET /prescriptions?status=` · `GET /prescriptions/:id` · `PATCH /prescriptions/:id/status`                                                                                                 |
| Billing         | `POST /invoices` · `GET /invoices?status=OPEN` · `GET /invoices/patients?q=` · `GET /invoices/:id` · `PATCH /invoices/:id` · `POST /invoices/:id/issue` · `POST /invoices/:id/void` · `POST /invoices/:id/payments` |

### Status flows

```text
Appointment   SCHEDULED → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED
              (CANCELLED from any open state, NO_SHOW after the start time)

Record        DRAFT → SIGNED

Prescription  DRAFT → ISSUED → DISPENSED
              (CANCELLED from DRAFT or ISSUED)

Invoice       DRAFT → ISSUED → PARTIALLY_PAID → PAID
              (VOID only when no payment has been taken)
```

---

## Testing the API

`apps/api/tests` has request files for the VS Code [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension. Each file logs in, saves the tokens and walks through a workflow. Requests marked **expect 400 / 403 / 409** are meant to fail and prove the rules work.

| File                     | Covers                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `day1-appointments.http` | Slots, booking, double booking, status changes, role checks       |
| `day2-clinical.http`     | Records, vitals validation, signing, prescriptions, privacy rules |
| `day3-billing.http`      | Invoices, part payments, idempotency, overpayment, voiding        |
| `day4-dashboard.http`    | Role based dashboard sections, billing patient lookup             |
| `production.http`        | Smoke test against the live deployment                            |

---

## Progress

- [x] Monorepo, Docker Compose, PostgreSQL and Redis
- [x] Authentication with refresh token rotation
- [x] Multi-tenant access control and role based permissions
- [x] Hospital onboarding, departments and staff
- [x] Patients: registration, search, edit, archive and clinical timeline
- [x] Doctor schedules, slot availability and appointment booking
- [x] Consultation workflow, medical records and prescriptions
- [x] Pharmacy queue
- [x] Billing: invoices, payments and idempotency
- [x] Role based dashboard
- [x] Cloud deployment on free plans
- [ ] Automated test suite
- [ ] Staff administration screens
- [ ] Laboratory module
- [ ] Printable invoices and prescriptions

---

## Security notes

- Passwords are hashed with bcrypt. Refresh tokens are stored hashed, never in plain text.
- All input is validated on the server with a whitelist, so unknown fields are rejected.
- Medical and billing records are never hard deleted. Patients are archived, invoices are voided with a reason, and signed records are locked.
- Clinical data is limited to clinical roles. Billing staff cannot open patient medical files.
- Secrets live in environment variables, never in the repository. Production uses different JWT secrets from development.
- The demo accounts use a public password on purpose. The super admin account on the live server has its own private password.

For design decisions, see [docs/architecture.md](docs/architecture.md) and [docs/decisions](docs/decisions).

---

## License

No open-source license has been selected yet.
