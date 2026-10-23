// README Section 9 / 10: HTTP end-to-end against a running instance.
// Run with: BASE_URL=http://localhost:3000 bun test test/e2e (after `docker compose up` and app running).
import { test, expect } from 'bun:test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const KEYCLOAK_ISSUER = (process.env.KEYCLOAK_ISSUER ?? 'http://localhost:8080/realms/wagering').split(',')[0].trim();
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? 'wagering-api-secret';
const KEYCLOAK_USERNAME = process.env.KEYCLOAK_TEST_USERNAME ?? 'testuser';
const KEYCLOAK_PASSWORD = process.env.KEYCLOAK_TEST_PASSWORD ?? 'testpass';

let serverUp = false;
let token: string | null = null;
let authRequired = true;
try {
  const r = await fetch(BASE + '/health/live');
  serverUp = r.ok;
} catch {
  serverUp = false;
}
// Try to obtain a Keycloak token from multiple possible hosts
try {
  const tr = await fetch(`${KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=password&client_id=wagering-api&client_secret=${KEYCLOAK_CLIENT_SECRET}&username=${KEYCLOAK_USERNAME}&password=${KEYCLOAK_PASSWORD}`,
  });
  if (tr.ok) {
    const j: any = await tr.json();
    token = j.access_token ?? null;
  }
} catch {
  token = null;
}
// If no token, check if the API is in no-op auth mode (protected endpoint accessible without token)
if (!token && serverUp) {
  try {
    const r = await fetch(BASE + '/wallets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: 'probe', initialBalance: { amount: '1.00', currency: 'BRL' } }) });
    if (r.status !== 401) authRequired = false;
  } catch {
    // ignore
  }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

// README Section 9: health endpoints open, no auth
test.skipIf(!serverUp)('health live and ready', async () => {
  const live = await req('/health/live');
  expect(live.status).toBe(200);
  expect(live.json.status).toBe('ok');
  const ready = await req('/health/ready');
  expect(ready.status).toBe(200);
  expect(ready.json.status).toBe('ready');
});

// README Section 9: create wallet
test.skipIf(!serverUp || (authRequired && !token))('create wallet returns balance and version', async () => {
  const playerId = 'e2e-' + crypto.randomUUID();
  const res = await req('/wallets', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ playerId, initialBalance: { amount: '100.00', currency: 'BRL' } }),
  });
  expect(res.status).toBe(201);
  expect(res.json.balance.amount).toBe('100.00');
  expect(res.json.version).toBe(1);
});

// README Section 9 / 7: submit BET then idempotent replay
test.skipIf(!serverUp || (authRequired && !token))('submit BET and idempotent replay', async () => {
  const playerId = 'e2e-' + crypto.randomUUID();
  const w = await req('/wallets', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ playerId, initialBalance: { amount: '100.00', currency: 'BRL' } }),
  });
  const walletId = w.json.id;
  const extId = 'e2e-t1-' + crypto.randomUUID();
  const idemKey = 'pa:' + extId;
  const body = JSON.stringify({
    providerId: 'pa', externalTransactionId: extId, playerId, walletId,
    roundId: 'r1', gameId: 'g1', kind: 'BET', money: { amount: '25.00', currency: 'BRL' },
  });
  const r1 = await req('/wagering/transactions', {
    method: 'POST',
    headers: { ...authHeaders(), 'Idempotency-Key': idemKey },
    body,
  });
  expect(r1.status).toBe(200);
  expect(r1.json.status).toBe('PROCESSED');
  expect(r1.json.balance.amount).toBe('75.00');
  expect(r1.json.idempotentReplay).toBe(false);

  const r2 = await req('/wagering/transactions', {
    method: 'POST',
    headers: { ...authHeaders(), 'Idempotency-Key': idemKey },
    body,
  });
  expect(r2.status).toBe(200);
  expect(r2.json.idempotentReplay).toBe(true);
  expect(r2.json.transactionId).toBe(r1.json.transactionId);
});

// README Section 9: reconciliation consistent
test.skipIf(!serverUp || (authRequired && !token))('reconciliation consistent after operations', async () => {
  const playerId = 'e2e-' + crypto.randomUUID();
  const w = await req('/wallets', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ playerId, initialBalance: { amount: '50.00', currency: 'BRL' } }),
  });
  const walletId = w.json.id;
  const recon = await req(`/wallets/${walletId}/reconciliation`, { method: 'POST', headers: authHeaders() });
  expect(recon.status).toBe(200);
  expect(recon.json.consistent).toBe(true);
});
