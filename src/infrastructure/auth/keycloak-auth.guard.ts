import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class KeycloakAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const path = req.url ?? "";
    // Health endpoints are always open
    if (path.startsWith("/health")) return true;

    const auth = req.headers?.authorization ?? "";
    if (!auth.startsWith("Bearer "))
      throw new UnauthorizedException("missing bearer token");

    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      throw new UnauthorizedException("invalid token");
    }
  }
}
