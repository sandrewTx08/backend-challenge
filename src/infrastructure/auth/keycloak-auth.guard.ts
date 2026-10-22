import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  private getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
    const url = process.env.KEYCLOAK_JWKS_URI;
    if (!url) return null;
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(url));
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // Health endpoints are always open
    const path = req.url ?? '';
    if (path.startsWith('/health')) return true;

    const jwks = this.getJwks();
    // If Keycloak not configured, run in no-op mode (dev / tests)
    if (!jwks) return true;

    const auth = req.headers?.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) throw new UnauthorizedException('missing bearer token');

    const issuer = process.env.KEYCLOAK_ISSUER;
    const audience = process.env.KEYCLOAK_AUDIENCE;
    // Only enforce audience if the token actually carries an aud claim.
    let enforceAudience = audience;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const json = Buffer.from(parts[1], 'base64url').toString('utf8');
        const claims = JSON.parse(json);
        if (!claims.aud) enforceAudience = undefined;
      }
    } catch {
      // ignore
    }
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: issuer || undefined,
        audience: enforceAudience || undefined,
      });
      req.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('invalid token');
    }
  }
}
