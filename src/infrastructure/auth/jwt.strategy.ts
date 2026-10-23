import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const jwksUri = process.env.KEYCLOAK_JWKS_URI;
    const issuerRaw = process.env.KEYCLOAK_ISSUER ?? '';
    const issuers = issuerRaw.split(',').map((s) => s.trim()).filter(Boolean);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Accept both localhost (local dev) and keycloak (docker) issuers
      issuer: issuers.length ? issuers : undefined,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksUri
        ? passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri,
          })
        : undefined,
    });
  }

  async validate(payload: any) {
    return payload;
  }
}
