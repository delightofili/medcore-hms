# MedCore HMS

A multi-tenant hospital management system for outpatient care. It covers the full patient journey: registration, booking, check in, consultation notes with vitals, prescriptions, and billing. Each hospital's data is kept fully separate from every other hospital's.

Built with NestJS, Next.js, PostgreSQL and Redis as my project for the Internmo Full Stack Development Internship.

**Developer:** Chukwunonso Ofili
**Status:** Core clinical and billing workflows complete. Billing screens, pharmacy queue, dashboard stats and deployment in progress.

> This is a learning project. Use invented data only. It is not a certified medical product and must not be used for real patient care.

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Engineering highlights](#engineering-highlights)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Testing the API](#testing-the-api)
- [Progress](#progress)
- [Security notes](#security-notes)

---

## What it does

A typical visit, from the front desk to the cashier:

1. **Reception** registers the patient and books them into one of the doctor's open slots.
2. On arrival, reception **checks the patient in**.
3. The **doctor** starts the consultation, records vitals and notes, writes a prescription, and **signs** the record. Signed records are locked.
4. The prescription is **issued** to the pharmacy, which marks it **dispensed**.
5. **Billing** raises an invoice, issues it, and records full or part payments until it is paid.

### Features

**Patients**

- Registration with automatic patient numbers, search by name, number, phone or email, edit and archive (soft delete)
- Duplicate detection on email and phone
- Allergy warning shown on the patient page and again during consultation

**Appointments**

- Weekly doctor schedules with slot lengths, plus blocked periods for leave
- Available slot calculation that excludes booked and blocked time
- Booking from open slots only, with protection against two people taking the same slot at once
- Day view with check in, start, complete, cancel (reason required) and no show
- Doctors only ever see their own schedule

**Clinical**

- Consultation page with vitals (temperature, blood pressure, pulse, respiratory rate, SpO₂, weight, height), complaint, symptoms, diagnosis and treatment plan
- Draft and sign workflow: a record needs a diagnosis to be signed and cannot be edited afterwards
- Prescriptions with multiple medicines, linked to the consultation they came from
- Patient timeline showing every past consultation with its vitals and prescriptions

**Billing**

- Invoices with line items, tax, discount and due date
- Draft, issued, partly paid, paid and void states
- Payments by cash, card, transfer, online or insurance, with part payments and overpayment protection
- Double click protection on payments through idempotency keys

**Platform**

- Multi-tenant: every request is checked against the user's hospital
- Role-based access for nine roles, enforced on the server and reflected in the UI
- Short-lived access tokens with silent refresh and refresh token rotation

---

## Tech stack

| Layer              | Technology                                                    |
| ------------------ | ------------------------------------------------------------- |
| Frontend           | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Forms              | React Hook Form, Zod                                          |
| Backend            | NestJS, TypeScript, class-validator                           |
| Database           | PostgreSQL 16 with Prisma ORM 6                               |
| Cache and sessions | Redis 7 (refresh token store)                                 |
| Auth               | JWT access tokens, rotating refresh tokens, bcrypt            |
| Infrastructure     | Docker Compose, pnpm workspaces                               |

---

## Engineering highlights

The parts of this project I'd point a reviewer to first.

**No double booking.** Booking an appointment runs inside a `SERIALIZABLE` Postgres transaction that checks the doctor's schedule, leave periods and overlapping appointments before inserting. If two receptionists book the same slot at the same instant, Postgres rejects one and the user gets a clear "this slot was just booked" message instead of a silent clash. The same approach protects payments from being recorded twice against the last part of a balance.
→ `apps/api/src/appointments/appointments.service.ts`

**State machines for every workflow.** Appointments, prescriptions and invoices each have an explicit table of allowed transitions, for example `CHECKED_IN → IN_PROGRESS → COMPLETED`. Status updates use `updateMany` matched on the current status, so if two people change the same record at once, the second gets a conflict instead of overwriting the first.

**Exact money maths.** All billing calculations use `Prisma.Decimal`, never JavaScript numbers (`0.1 + 0.2` is `0.30000000000000004` in JavaScript). Totals, balances and overdue flags are calculated on the server only, and the client never sends an amount it owes.
→ `apps/api/src/billing/billing.service.ts`

**Idempotent payments.** The client sends a unique key with each payment attempt. If the same key arrives twice, for example from a double click on a slow network, the server returns the existing result instead of charging again.

**Tenant isolation.** Every hospital-scoped route goes through a membership check before any query, and every query filters by `hospitalId`. Resources from another hospital, or another doctor's appointments, return `404` rather than `403`, so the API never confirms that a record exists.
→ `apps/api/src/auth/tenant-access.service.ts`

**Clinical safety rules on the server.** Only doctors can write records. A record can only be attached to a consultation that has started. A prescription takes its patient and doctor from the medical record, never from the request body, so medicines can't be attached to the wrong patient. Vitals have plausibility ranges, so a temperature of 370 is rejected as a typing error.

**Token handling.** Access tokens last 15 minutes. Refresh tokens are hashed in Redis, rotated on every use, and rejected if reused. The frontend refreshes silently on a `401` and shares one refresh call between parallel requests, so a page firing three requests at once doesn't log the user out.
→ `apps/web/src/providers/auth-provider.tsx`

---

## Project structure

```text
medcore-hms/
├── apps/
│   ├── api/                      NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma     Database schema (25 models)
│   │   │   ├── migrations/       SQL migrations
│   │   │   └── seed.js           Demo hospital, staff and patients
│   │   ├── src/
│   │   │   ├── auth/             Login, refresh, guards, tenant access
│   │   │   ├── hospitals/        Hospital onboarding
│   │   │   ├── departments/
│   │   │   ├── staff/            Staff accounts and doctor profiles
│   │   │   ├── patients/
│   │   │   ├── availability/     Doctor schedules and open slots
│   │   │   ├── appointments/
│   │   │   ├── clinical/         Medical records and prescriptions
│   │   │   └── billing/          Invoices and payments
│   │   └── tests/                REST Client .http files
│   └── web/                      Next.js frontend
│       └── src/
│           ├── app/              Routes (login, dashboard, patients, appointments)
│           ├── components/       UI, forms, clinical and appointment components
│           ├── lib/              API client and formatting helpers
│           ├── providers/        Auth provider with token refresh
│           └── types/            Frontend types
├── packages/types/               Shared TypeScript contracts
├── docs/
│   ├── architecture.md
│   └── decisions/                Architecture decision records
├── docker-compose.yml            PostgreSQL and Redis
└── package.json                  Workspace scripts
```

---

## Getting started

### Prerequisites

- Node.js 22
- pnpm 9.15.9 (`npm install -g pnpm@9.15.9`)
- Docker Desktop with Docker Compose
- Git

### 1. Clone and install

```bash
git clone https://github.com/delightofili/medcore-hms.git
cd medcore-hms
pnpm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Then open `.env` and replace the database password, Redis password and both JWT secrets with your own values. You can generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Never commit `.env`.

### 3. Start PostgreSQL and Redis

```bash
pnpm infra:up
pnpm infra:status
```

Both containers should show as running. PostgreSQL listens on port `5433` and Redis on `6379`, both bound to localhost only.

### 4. Set up the database

Run these from the repository root so Prisma reads the root `.env`:

```bash
pnpm exec prisma generate --schema apps/api/prisma/schema.prisma
pnpm exec prisma migrate deploy --schema apps/api/prisma/schema.prisma
pnpm db:seed
```

`migrate deploy` applies the existing migrations. The seed creates a demo hospital, staff accounts with doctor schedules, and five patients. It is safe to run more than once.

### 5. Run the apps

In two separate terminals:

```bash
# Terminal 1: API on http://localhost:3001/api
cd apps/api
pnpm dev
```

```bash
# Terminal 2: frontend on http://localhost:3000
cd apps/web
pnpm dev
```

Open http://localhost:3000 and sign in with one of the demo accounts below.

### Useful commands

| Command                                                          | What it does                        |
| ---------------------------------------------------------------- | ----------------------------------- |
| `pnpm infra:up` / `pnpm infra:down`                              | Start or stop PostgreSQL and Redis  |
| `pnpm infra:logs`                                                | Show recent database and Redis logs |
| `pnpm db:seed`                                                   | Load or refresh demo data           |
| `pnpm exec prisma studio --schema apps/api/prisma/schema.prisma` | Browse the database in the browser  |

---

## Demo accounts

All accounts use the password **`MedCoreDev2026!`** and belong to _MedCore General Hospital_.

| Email                     | Role                      | Good for trying                                         |
| ------------------------- | ------------------------- | ------------------------------------------------------- |
| `reception@medcore.test`  | Receptionist              | Registering patients, booking, check in, taking payment |
| `doctor@medcore.test`     | Doctor (General Practice) | Consultations, records, prescriptions                   |
| `doctor2@medcore.test`    | Doctor (Paediatrics)      | A second schedule to book against                       |
| `nurse@medcore.test`      | Nurse                     | Read-only clinical view                                 |
| `accountant@medcore.test` | Accountant                | Billing                                                 |
| `admin@medcore.test`      | Hospital admin            | Staff and hospital management                           |
| `superadmin@medcore.test` | Super admin               | Platform level, not tied to one hospital                |

Both doctors work Monday to Friday, 09:00 to 17:00, in 30 minute slots.

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
| Dispense prescriptions           |   ✓   |          |       |           |            |     ✓      |
| Invoices and payments            |   ✓   |          |       |     ✓     |     ✓      |            |

---

## API reference

All routes are prefixed with `/api`. Everything except login, register and refresh requires a `Bearer` access token. Hospital-scoped routes start with `/api/hospitals/:hospitalId`.

### Auth

| Method | Route            | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| POST   | `/auth/register` | Create an account                            |
| POST   | `/auth/login`    | Returns access token, refresh token and user |
| POST   | `/auth/refresh`  | Exchange a refresh token for a new pair      |
| POST   | `/auth/logout`   | Revoke a refresh token                       |
| GET    | `/auth/me`       | Current user                                 |

### Patients

| Method | Route                                             | Description           |
| ------ | ------------------------------------------------- | --------------------- |
| POST   | `/hospitals/:hospitalId/patients`                 | Register a patient    |
| GET    | `/hospitals/:hospitalId/patients?q=&page=&limit=` | Search and list       |
| GET    | `/hospitals/:hospitalId/patients/:patientId`      | Patient details       |
| PATCH  | `/hospitals/:hospitalId/patients/:patientId`      | Update                |
| DELETE | `/hospitals/:hospitalId/patients/:patientId`      | Archive (soft delete) |

### Doctors and schedules

| Method | Route                                                            | Description          |
| ------ | ---------------------------------------------------------------- | -------------------- |
| GET    | `/hospitals/:hospitalId/doctors`                                 | List active doctors  |
| POST   | `/hospitals/:hospitalId/doctors/:doctorId/availability`          | Set weekly schedule  |
| GET    | `/hospitals/:hospitalId/doctors/available-slots?doctorId=&date=` | Open slots for a day |

### Appointments

| Method | Route                                                                    | Description     |
| ------ | ------------------------------------------------------------------------ | --------------- |
| POST   | `/hospitals/:hospitalId/appointments`                                    | Book a slot     |
| GET    | `/hospitals/:hospitalId/appointments?date=&doctorId=&patientId=&status=` | List and filter |
| GET    | `/hospitals/:hospitalId/appointments/:appointmentId`                     | Details         |
| PATCH  | `/hospitals/:hospitalId/appointments/:appointmentId/status`              | Change status   |

### Medical records

| Method | Route                                                       | Description               |
| ------ | ----------------------------------------------------------- | ------------------------- |
| POST   | `/hospitals/:hospitalId/medical-records`                    | Create a draft record     |
| GET    | `/hospitals/:hospitalId/medical-records?patientId=&status=` | List                      |
| GET    | `/hospitals/:hospitalId/medical-records/:recordId`          | Record with prescriptions |
| PATCH  | `/hospitals/:hospitalId/medical-records/:recordId`          | Edit a draft              |
| POST   | `/hospitals/:hospitalId/medical-records/:recordId/sign`     | Sign and lock             |

### Prescriptions

| Method | Route                                                         | Description                  |
| ------ | ------------------------------------------------------------- | ---------------------------- |
| POST   | `/hospitals/:hospitalId/prescriptions`                        | Create from a medical record |
| GET    | `/hospitals/:hospitalId/prescriptions?patientId=&status=`     | List                         |
| GET    | `/hospitals/:hospitalId/prescriptions/:prescriptionId`        | Details                      |
| PATCH  | `/hospitals/:hospitalId/prescriptions/:prescriptionId/status` | Issue, dispense or cancel    |

### Billing

| Method | Route                                                 | Description                              |
| ------ | ----------------------------------------------------- | ---------------------------------------- |
| POST   | `/hospitals/:hospitalId/invoices`                     | Create a draft invoice                   |
| GET    | `/hospitals/:hospitalId/invoices?patientId=&status=`  | List                                     |
| GET    | `/hospitals/:hospitalId/invoices/:invoiceId`          | Invoice with items, payments and balance |
| PATCH  | `/hospitals/:hospitalId/invoices/:invoiceId`          | Edit a draft                             |
| POST   | `/hospitals/:hospitalId/invoices/:invoiceId/issue`    | Issue                                    |
| POST   | `/hospitals/:hospitalId/invoices/:invoiceId/void`     | Void (reason required)                   |
| POST   | `/hospitals/:hospitalId/invoices/:invoiceId/payments` | Record a payment                         |

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

The `apps/api/tests` folder has request files for the VS Code [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension. Each file logs in, saves the tokens automatically, and walks through a full workflow. Requests marked **expect 400 / 403 / 409** are meant to fail and prove the rules work.

| File                     | Covers                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `day1-appointments.http` | Slots, booking, double booking, status changes, role checks       |
| `day2-clinical.http`     | Records, vitals validation, signing, prescriptions, privacy rules |
| `day3-billing.http`      | Invoices, part payments, idempotency, overpayment, voiding        |

Run the API and the seed first, then open a file and click **Send Request** above each block from top to bottom.

---

## Progress

- [x] Monorepo, Docker Compose, PostgreSQL and Redis
- [x] Prisma schema and migrations
- [x] Authentication with refresh token rotation
- [x] Multi-tenant access control and role-based permissions
- [x] Hospital onboarding, departments and staff
- [x] Patient registration, search, edit and archive
- [x] Doctor schedules and slot availability
- [x] Appointment booking and day view
- [x] Consultation workflow, medical records and prescriptions
- [x] Patient clinical history
- [x] Billing API: invoices and payments
- [ ] Billing and pharmacy screens
- [ ] Dashboard statistics
- [ ] Cloud deployment
- [ ] Automated test suite
- [ ] Laboratory module

---

## Security notes

- Passwords are hashed with bcrypt. Refresh tokens are stored hashed, never in plain text.
- All input is validated on the server with a whitelist, so unknown fields are rejected.
- Medical and billing records are never hard deleted. Patients are archived, invoices are voided with a reason, and signed records are locked.
- Clinical data is limited to clinical roles. Billing staff cannot open patient medical files.
- Secrets live in `.env`, which is git-ignored. The values in `.env.example` are for local development only.

For the architecture and design decisions, see [docs/architecture.md](docs/architecture.md) and [docs/decisions](docs/decisions).

---

## License

No open-source license has been selected yet.
