import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { commercialScopeBlocks } from "../commercial-scope";

/** Rejects optional-product routes when the commercial v1 scope is enabled. */
@Injectable()
export class CommercialScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = req.path || req.url || "";
    const blocked = commercialScopeBlocks(path.split("?")[0]);
    if (blocked) {
      throw new ForbiddenException(
        `This module is outside the commercial v1 scope (${blocked} is not enabled).`,
      );
    }
    return true;
  }
}
