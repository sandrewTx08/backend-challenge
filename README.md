# Distributed Wagering Processor

NestJS (Bun runtime) service processing wagering transactions from multiple
game providers. PostgreSQL is the source of truth; AWS SQS (LocalStack) provides
at-least-once delivery. Financial state changes are atomic via a single SQL
transaction spanning wallet, ledger, inbox and outbox.

See `ARCHITECTURE.md` for design decisions, concurrency strategy, and trade-offs.

## Stack

- Runtime: Bun 1.4.4 / TypeScript (strict)
- Framework: NestJS 10
- ORM: MikroORM 6 (PostgreSQL)
- DB: PostgreSQL 15
- Messaging: AWS SQS FIFO via LocalStack 3.8
- Auth: Keycloak (OIDC/JWT) — optional, no-op mode when unconfigured
- Proxy: nginx (least_conn) over API replicas

## Prerequisites

- Bun 1.4.4, Node 22.17, Docker Desktop.

## Run locally

```bash
bun docker:down
bun docker:dev
bun install
bun run start:dev # migrations auto-apply
```

Health: `curl http://localhost:3000/health/live`

## Run with Docker (deployment)

```bash
docker compose --env-file ./.env.prod up -d --build
```

Scale replicas: set `API_REPLICAS=N` in `.env.prod`.

## Keycloak token (optional auth)

```bash
curl -X POST http://localhost:8080/realms/wagering/protocol/openid-connect/token \
  -d 'grant_type=password&client_id=wagering-api&client_secret=wagering-api-secret&username=testuser&password=testpass'
```

## Tests

```bash
bun run test:unit
bun run test:integration
bun run test:concurrency
BASE_URL=http://localhost:3000 bun test test/e2e
bun run test:load
```

## API overview

- `POST /wallets` — create wallet (initial balance generates OPENING transaction + ledger entry)
- `GET /wallets/:walletId`
- `GET /wallets/:walletId/ledger?limit=50&cursor=...` — cursor-paginated ledger
- `POST /wallets/:walletId/reconciliation`
- `POST /wagering/transactions` (header `Idempotency-Key`)
- `GET /health/live`, `GET /health/ready`

## Environment files

- `.env` — local development
- `.env.prod` — docker deployment
