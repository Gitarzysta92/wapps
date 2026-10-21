import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../decorators/auth-user.decorator';
import type { DiscussionActor } from '@sdk/features/discussion/libs/management';

export function discussionActor(
  user: AuthenticatedUser
): DiscussionActor | null {
  if (!user.userId || user.isAnonymous) return null;
  const tenant =
    user.userClaims?.tenantId ??
    process.env.DISCUSSION_PUBLIC_TENANT ??
    'default';
  const roles = user.userClaims?.roles ?? [];
  if (
    typeof tenant !== 'string' ||
    !tenant ||
    tenant.length > 128 ||
    !Array.isArray(roles) ||
    roles.length > 64 ||
    !roles.every((role) => typeof role === 'string' && role.length <= 128)
  )
    throw new BadRequestException('Invalid actor scope');
  return { identityId: user.userId, tenantId: tenant, roles };
}

export function requiredActor(user: AuthenticatedUser): DiscussionActor {
  const actor = discussionActor(user);
  if (!actor) throw new BadRequestException('Authenticated actor required');
  return actor;
}
