import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Decorator to extract authenticated user information from request.
 * Mirrors the pattern used in `apps/services/catalog-bff`.
 */
export const AuthUser = createParamDecorator(
  (options: { optional?: boolean } = {}, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const user: AuthenticatedUser = {
      userId: request.userId,
      userEmail: request.userEmail,
      authTime: request.authTime,
      userClaims: request.userClaims,
      isAnonymous: request.isAnonymous || false,
    };

    if (!user.userId && (user.isAnonymous || options.optional)) {
      return user;
    }

    if (!user.userId && !options.optional) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }
);

export interface AuthenticatedUser {
  userId?: string;
  userEmail?: string;
  authTime?: string;
  userClaims?: Record<string, any>;
  isAnonymous: boolean;
}
