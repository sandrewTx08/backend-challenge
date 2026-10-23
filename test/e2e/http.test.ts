// README Section 9 / 10: HTTP end-to-end against a running instance.
// Run with: BASE_URL=http://localhost:3000 bun test test/e2e (after `docker compose up` and app running).
import { test, expect } from 'bun:test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

let serverUp = false;
let token: string | null = null;
try {
  const r = await fetch(BASE + '/health/live');
  serverUp = r.ok;
} catch {
  serverUp = false;
}
// Try to obtain a Keycloak token (optional)
try {
  const tr = await fetch('http://localhost:8080/realms/wagering/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=password&client_id=wagering-api&client_secret=wagering-api-secret&username=testuser&password=testpass',
  });
  if (tr.ok) {
    const j: any = await tr.json();
    token = j.access_token ?? null;
  }
} catch (e) {
  console.log('token fetch error:', e);
  token = null;
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
test.skipIf(!serverUp || !token)('create wallet returns balance and version', async () => {
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
test.skipIf(!serverUp || !token)('submit BET and idempotent replay', async () => {
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
test.skipIf(!serverUp || !token)('reconciliation consistent after operations', async () => {
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
