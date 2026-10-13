import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Decorator to extract authenticated user information from request.
 * Mirrors the pattern used in `apps/services/catalog-bff`.
 */
export const AuthUser = createParamDecorator(
  (options: { optional?: boolean } = {}, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return extractAuthUser(request, options.optional);
  }
);

export interface AuthenticatedUser {
  userId?: string;
  userEmail?: string;
  authTime?: string;
  userClaims?: Record<string, unknown>;
  isAnonymous: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function extractAuthUser(
  request: Pick<AuthenticatedRequest, 'authUser'>,
  optional = false
): AuthenticatedUser {
  const user = request.authUser ?? { isAnonymous: true };
  if (!optional && (!user.userId || user.isAnonymous))
    throw new UnauthorizedException('Authentication required');
  return user;
}
