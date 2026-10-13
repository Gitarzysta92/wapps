import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  userEmail?: string;
  authTime?: string;
  userClaims?: Record<string, unknown>;
  isAnonymous: false;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export const AuthUser = createParamDecorator(
  (_options: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().authUser;
    if (!user) throw new UnauthorizedException('Authentication required');
    return user;
  }
);
