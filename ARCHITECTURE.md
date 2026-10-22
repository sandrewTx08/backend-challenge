# Architecture — Distributed Wagering Processor

## Overview
NestJS (Bun runtime) service processing wagering transactions from multiple
providers. PostgreSQL is the source of truth; AWS SQS (LocalStack) provides
at-least-once delivery. All financial state changes are atomic via a single
SQL transaction spanning wallet, ledger, inbox and outbox.

## Stack
- Runtime: Bun 1.x
- Framework: NestJS 10
- ORM: MikroORM 6 (PostgreSQL driver) — chosen for explicit Unit of Work,
  Identity Map and `LockMode.PESSIMISTIC_WRITE` for per-wallet row locks.
- DB: PostgreSQL 15
- Messaging: AWS SQS FIFO via LocalStack 3.8
- Auth: Keycloak (OIDC/JWT) — optional; runs in no-op mode when
  `KEYCLOAK_JWKS_URI` is unset.
- Migrations: MikroORM migrator, versioned & reversible.

## Money
Stored internally as integer cents (BigInt). External representation is a
decimal string with fixed scale 2 (`"25.00"`). No `number`/`float`/`double`
is ever used for money. Currency mismatch throws `MoneyValidationError`.

## Concurrency
Unit of concurrency is `walletId`. Pessimistic row lock
(`SELECT ... FOR UPDATE`) is taken on the wallet row inside the transaction.
Different wallets proceed in parallel (row-level locks); a global lock is
never used. Optimistic `version` column is maintained for audit/ETag.

## Idempotency
Persistent, keyed by `Idempotency-Key` header (source of truth). `payloadHash`
is SHA-256 of a canonical JSON (sorted keys) of business fields. Identical
request → replay with original result. Same key with different payload → 409
conflict. Inbox table dedups SQS deliveries by `(consumerName, messageId)`.

## Transactional Outbox
Wallet + ledger + inbox + outbox rows are written in one SQL transaction.
Events are never published before commit. A poller publishes pending outbox
rows with backoff; `FOR UPDATE SKIP LOCKED` allows concurrent publishers.
FIFO queue `MessageDeduplicationId = outbox.id` makes duplicate publication
safe.

## State machine (WagerTransaction)
PENDING → PROCESSED | REJECTED | FAILED | PENDING_REFERENCE.
Terminal states (PROCESSED/REJECTED/FAILED) cannot transition.

## Failure codes
See `src/domain/common/failure-code.ts`. Business rejections carry a stable
machine-readable code; transient infra errors are retried.

## Reference handling (out of order)
REFUND/ROLLBACK with missing reference → PENDING_REFERENCE + event. A worker
reprocesses pending references with exponential backoff; after the attempt
limit → REJECTED (REFERENCE_NOT_FOUND).

## Health
`GET /health/live` (liveness), `GET /health/ready` (Postgres + SQS).

## Running
See README.md setup section and docker-compose.yml.
`docker compose up` starts Postgres, LocalStack and Keycloak.
`bun run start` runs the app (migrations auto-apply).

## Tests
- Unit: `bun run test:unit`
- Integration: `bun run test:integration`
- Concurrency: `bun run test:concurrency`

## Limitations / trade-offs
- Single currency assumed BRL in practice, but model stays multi-currency.
- Outbox publishes to a dedicated `wager-events.fifo` queue.
- Reconciliation reports divergence but never silently corrects.
- Pending-reference worker runs in-process (single leader not enforced;
  reprocessing is idempotent).
