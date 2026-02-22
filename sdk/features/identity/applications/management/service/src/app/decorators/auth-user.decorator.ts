import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const AuthUser = createParamDecorator((_options: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();

  const user: AuthenticatedUser = {
    userId: request.userId,
    userEmail: request.userEmail,
    authTime: request.authTime,
    userClaims: request.userClaims,
    isAnonymous: request.isAnonymous || false,
  };

  if (!user.userId) {
    throw new UnauthorizedException('Authentication required');
  }

  return user;
});

export interface AuthenticatedUser {
  userId: string;
  userEmail?: string;
  authTime?: string;
  userClaims?: Record<string, any>;
  isAnonymous: boolean;
}

