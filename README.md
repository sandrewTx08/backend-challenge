# Local Development Manual — NestJS on localhost

This guide runs the NestJS API directly on the host (localhost) with Bun,
while Postgres, LocalStack and Keycloak run in Docker.

## 1. Prerequisites

- Bun 1.4.4 (`bun --version`)
- Node 22.17 (for tooling)
- Docker Desktop (running)
- Git

## 2. Start infrastructure (Docker)

```bash
bun docker:prod
```

Wait for healthy status:

```bash
docker compose ps
```

## 3. Install dependencies

```bash
bun install
```

## 5. Run the API (localhost)

```bash
bun docker:dev
```

The API listens on `http://localhost:3000` (or `$PORT`).

## 6. Verify

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

## 7. Keycloak authentication & getting a token

Authentication is required via a JWT Bearer token on requests (`Authorization: Bearer <token>`). To obtain a token, send a request to Keycloak:

```bash
curl -X POST http://localhost:8080/realms/wagering/protocol/openid-connect/token \
  -d 'grant_type=password&client_id=wagering-api&client_secret=wagering-api-secret&username=testuser&password=testpass'
```

Use the returned `access_token` as:
`Authorization: Bearer <token>`

## 8. Run tests locally

```bash
bun run test
bun run test:load # requires running API
```

## 9. Debugging

- Logs: structured JSON to stdout.
- Set `LOG_LEVEL=debug` in `.env`.
- DB: `docker exec -it wagering-postgres psql -U postgres -d wagering`.
- SQS: `awslocal sqs list-queues` (inside localstack container).

## Notes

- Migrations run automatically on startup (`orm.getMigrator().up()`).
- For multi-instance testing, run multiple `bun run start` on different ports.
