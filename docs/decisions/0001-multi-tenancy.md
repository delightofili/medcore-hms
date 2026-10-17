# ADR-0001: Row-Level Multi-Tenancy

- Status: Accepted for the initial implementation
- Date: 2026-10-17

## Context

MedCore HMS must support multiple hospitals within
one application deployment while preventing one
hospital from accessing another hospital's records.

## Decision

Use a shared PostgreSQL database and shared schema.
Hospital-specific data will be associated with a
hospital through hospitalId or an explicitly modelled
relationship to a hospital-owned record.

The authenticated identity determines the user's
hospital scope. The API must not rely on a client
supplied hospitalId as proof of authorization.

## Alternatives considered

1. Database per tenant:
   Stronger physical separation but more operational
   overhead for provisioning, migrations, and backups.

2. Schema per tenant:
   Provides logical separation but increases migration
   and schema-management complexity.

3. Row-level multi-tenancy:
   Supports shared infrastructure and consistent
   migrations, but requires rigorous tenant isolation.

## Consequences

- Shared infrastructure is simpler to operate.
- Queries and writes must enforce tenant ownership.
- Indexes must support tenant-scoped access patterns.
- Tenant-isolation tests are mandatory.
- PostgreSQL Row-Level Security may provide an
  additional defence-in-depth layer after the initial
  access-control design is established.

## Security note

A hospitalId column alone does not guarantee tenant
isolation. Authorization checks, constrained queries,
database protections, and automated tests are required.
