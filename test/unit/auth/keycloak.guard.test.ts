import { test, expect } from 'bun:test';
import { KeycloakAuthGuard } from '../../../src/infrastructure/auth/keycloak-auth.guard';

// README Section 2 / 9: health endpoints open; guard no-op when Keycloak not configured
test('KeycloakAuthGuard allows health endpoints without token', async () => {
  const guard = new KeycloakAuthGuard();
  const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ url: '/health/live', headers: {} }) }) };
  expect(await guard.canActivate(ctx)).toBe(true);
});

test('KeycloakAuthGuard no-op allows protected route when unconfigured', async () => {
  const guard = new KeycloakAuthGuard();
  const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ url: '/wallets', headers: {} }) }) };
  // KEYCLOAK_JWKS_URI unset -> no-op
  delete process.env.KEYCLOAK_JWKS_URI;
  expect(await guard.canActivate(ctx)).toBe(true);
});
