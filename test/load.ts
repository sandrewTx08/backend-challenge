// Load test script: `bun run test:load`
// Fires concurrent BET requests against a running instance.
// Env: BASE_URL (default http://localhost:3000), WORKERS (20), REQUESTS (200), AMOUNT (1.00)
import { performance } from 'node:perf_hooks';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER ?? 'http://localhost:8080/realms/wagering';
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? 'wagering-api-secret';
const WORKERS = parseInt(process.env.WORKERS ?? '20', 10);
const REQUESTS = parseInt(process.env.REQUESTS ?? '200', 10);
const AMOUNT = process.env.AMOUNT ?? '1.00';

async function req(path: string, init?: RequestInit) {
  const start = performance.now();
  try {
    const res = await fetch(BASE + path, init);
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: res.status, json, latency: performance.now() - start };
  } catch (e: any) {
    return { status: 0, json: null, latency: performance.now() - start, error: String(e) };
  }
}

async function getToken() {
  try {
    const tokenUrl = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
    const tr = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=password&client_id=wagering-api&client_secret=${KEYCLOAK_CLIENT_SECRET}&username=${process.env.KEYCLOAK_TEST_USERNAME ?? 'testuser'}&password=${process.env.KEYCLOAK_TEST_PASSWORD ?? 'testpass'}`,
    });
    if (tr.ok) return ((await tr.json()) as any).access_token as string;
  } catch {}
  return null;
}

async function main() {
  console.log(`Load test: ${WORKERS} workers, ${REQUESTS} requests, amount ${AMOUNT}, base ${BASE}`);
  // create wallet with enough balance
  const playerId = 'load-' + crypto.randomUUID();
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const w = await req('/wallets', {
    method: 'POST',
    headers,
    body: JSON.stringify({ playerId, initialBalance: { amount: String(REQUESTS * parseFloat(AMOUNT) + 100), currency: 'BRL' } }),
  });
  if (w.status !== 201) {
    console.error('Failed to create wallet:', w.status, w.json);
    process.exit(1);
  }
  const walletId = (w.json as any).id;

  const latencies: number[] = [];
  let ok = 0, errors = 0, conflicts = 0, other = 0;
  const startAll = performance.now();

  // worker pool
  let counter = 0;
  async function worker() {
    while (true) {
      const i = counter++;
      if (i >= REQUESTS) break;
      const extId = `load-${i}`;
      const r = await req('/wagering/transactions', {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': `pa:${extId}` },
        body: JSON.stringify({
          providerId: 'pa', externalTransactionId: extId, playerId, walletId,
          roundId: 'load-round', gameId: 'load-game', kind: 'BET',
          money: { amount: AMOUNT, currency: 'BRL' },
        }),
      });
      latencies.push(r.latency);
      if (r.status === 200 && r.json?.status === 'PROCESSED') ok++;
      else if (r.status === 409) conflicts++;
      else if (r.status >= 400) errors++;
      else other++;
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  const totalMs = performance.now() - startAll;
  const rps = (REQUESTS / (totalMs / 1000)).toFixed(2);

  latencies.sort((a, b) => a - b);
  const pct = (p: number) => latencies[Math.floor((p / 100) * (latencies.length - 1))] ?? 0;
  const p50 = pct(50).toFixed(2);
  const p95 = pct(95).toFixed(2);
  const p99 = pct(99).toFixed(2);
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const errRate = ((errors + conflicts) / REQUESTS * 100).toFixed(2);

  console.log('\n=== Load Test Report ===');
  console.log(`Requests: ${REQUESTS}  Workers: ${WORKERS}`);
  console.log(`Total time: ${totalMs.toFixed(2)} ms`);
  console.log(`Throughput: ${rps} RPS`);
  console.log(`Latency ms  -> avg: ${avg}  p50: ${p50}  p95: ${p95}  p99: ${p99}`);
  console.log(`Processed: ${ok}  Conflicts(409): ${conflicts}  Errors: ${errors}  Other: ${other}`);
  console.log(`Error rate: ${errRate}%`);
  console.log(`Outbox lag: N/A (requires DB access; check outbox_messages.published_at)`);
  console.log('========================\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
