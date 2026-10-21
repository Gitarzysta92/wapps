import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import type {
  DiscussionActor,
  DiscussionResource,
} from './discussion-write.port';

export function canReadDiscussion(
  resource: DiscussionResource,
  actor: DiscussionActor | null
): boolean {
  if (resource.deletedAt !== null || resource.rootDeletedAt !== null)
    return false;
  if (actor && resource.tenantId !== actor.tenantId) return false;
  const moderator = actor?.roles.includes('admin') === true;
  const canReadRoot =
    (resource.rootState === 'published' &&
      resource.rootVisibility !== 'private') ||
    actor?.identityId === resource.rootOwnerIdentityId ||
    moderator;
  const canReadNode =
    (resource.state === 'published' && resource.visibility !== 'private') ||
    actor?.identityId === resource.ownerIdentityId ||
    moderator;
  return canReadRoot && canReadNode;
}

export function assertDiscussionWriteAccess(
  resource: DiscussionResource,
  actor: DiscussionActor,
  action: string
): void {
  if (
    actor.tenantId !== resource.tenantId ||
    !canReadDiscussion(resource, actor)
  )
    throw new PermissionDeniedError(action);
  if (
    (action === 'discussion.update' || action === 'discussion.delete') &&
    actor.identityId !== resource.ownerIdentityId &&
    !actor.roles.includes('admin')
  )
    throw new PermissionDeniedError(action);
  if (action.startsWith('discussion.comment.') && resource.kind !== 'comment')
    throw new PermissionDeniedError(action);
  if (
    action === 'discussion.pin' &&
    (!actor.roles.includes('admin') ||
      resource.kind !== 'discussion' ||
      resource.id !== resource.discussionId)
  )
    throw new PermissionDeniedError(action);
}
