import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Decorator to extract authenticated user information from request.
 * Use this in controllers to access validated user data.
 * 
 * @example
 * ```typescript
 * @Get('/my-listings')
 * getMyListings(@AuthUser() user: AuthenticatedUser) {
 *   console.log(user.userId); // Firebase user ID
 *   return this.catalogService.getUserListings(user.userId);
 * }
 * ```
 * 
 * @example Optional auth
 * ```typescript
 * @Get('/personalized')
 * getPersonalized(@AuthUser({ optional: true }) user?: AuthenticatedUser) {
 *   if (user?.isAnonymous) {
 *     return this.catalogService.getPublicContent();
 *   }
 *   return this.catalogService.getPersonalizedContent(user.userId);
 * }
 * ```
 */
export const AuthUser = createParamDecorator(
  (options: { optional?: boolean } = {}, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    const user: AuthenticatedUser | undefined = {
      userId: request.userId,
      userEmail: request.userEmail,
      authTime: request.authTime,
      userClaims: request.userClaims,
      isAnonymous: request.isAnonymous || false,
    };

    // If anonymous or no user info
    if (!user.userId && (user.isAnonymous || options.optional)) {
      return user;
    }

    // If user info required but not present
    if (!user.userId && !options.optional) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  },
);

export interface AuthenticatedUser {
  userId?: string;
  userEmail?: string;
  authTime?: string;
  userClaims?: Record<string, any>;
  isAnonymous: boolean;
}

