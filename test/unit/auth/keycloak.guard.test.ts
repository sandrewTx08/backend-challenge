import { test, expect } from "bun:test";
import { KeycloakAuthGuard } from "../../../src/infrastructure/auth/keycloak-auth.guard";
import { UnauthorizedException } from "@nestjs/common";

// README Section 2 / 9: health endpoints open; guard no-op when Keycloak not configured
test("KeycloakAuthGuard allows health endpoints without token", async () => {
  const guard = new KeycloakAuthGuard();
  const ctx: any = {
    switchToHttp: () => ({
      getRequest: () => ({ url: "/health/live", headers: {} }),
    }),
  };
  expect(await guard.canActivate(ctx)).toBe(true);
});

test("KeycloakAuthGuard dont allow protected route when unconfigured", async () => {
  const guard = new KeycloakAuthGuard();
  const ctx: any = {
    switchToHttp: () => ({
      getRequest: () => ({ url: "/wallets", headers: {} }),
    }),
  };
  delete process.env.KEYCLOAK_JWKS_URI;
  await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
});
