import type { DiscussionTarget } from '@domains/community';
import { DiscussionNotFoundError } from './discussion-write.port';

export interface DiscussionTargets {
  visible(target: DiscussionTarget, tenantId: string): Promise<boolean>;
}

/** Linked comments are exposed only through their target-specific use case. */
export async function assertDiscussionTarget(
  actual: DiscussionTarget | null | undefined,
  expected: DiscussionTarget | undefined,
  tenantId: string,
  targets?: DiscussionTargets
): Promise<void> {
  if (!actual && !expected) return;
  if (
    !actual ||
    !expected ||
    actual.kind !== expected.kind ||
    actual.id !== expected.id ||
    !targets ||
    !(await targets.visible(actual, tenantId))
  )
    throw new DiscussionNotFoundError('Article comments are not available');
}
