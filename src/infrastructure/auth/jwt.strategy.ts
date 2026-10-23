import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    const jwksUri = process.env.KEYCLOAK_JWKS_URI ?? "";
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["RS256"],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
    });
  }

  async validate(payload: any) {
    return payload;
  }
}
