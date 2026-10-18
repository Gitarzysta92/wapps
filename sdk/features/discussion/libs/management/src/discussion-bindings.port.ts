import { discussionKey } from '@sdk/features/discussion/core';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
  type DiscussionResource,
} from './discussion-write.port';

export interface DiscussionChanges {
  state?: DiscussionResource['state'];
  visibility?: DiscussionResource['visibility'];
  subjectId?: string;
}

/** The consuming application supplies meaning, payload rules and current parent authority. */
export interface DiscussionBindingAccess {
  visible(key: string, tenantId: string): Promise<boolean>;
  anonymous(key: string | undefined, payload: unknown): unknown;
}

export interface DiscussionBindings extends DiscussionBindingAccess {
  content(key: string, node: 'discussion' | 'comment', input: unknown): unknown;
  authorize(
    key: string,
    actor: DiscussionActor,
    action: string,
    resource?: DiscussionResource,
    changes?: DiscussionChanges
  ): Promise<void>;
  context(
    key: string,
    content: unknown,
    actor: DiscussionActor
  ): Promise<unknown>;
  /** Adapts historical consumer request identities without teaching the engine their formats. */
  fingerprintInput(input: unknown): unknown;
}

export async function assertDiscussionBinding(
  actual: string | null | undefined,
  expected: string | undefined,
  tenantId: string,
  bindings?: Pick<DiscussionBindingAccess, 'visible'>
): Promise<void> {
  if (actual == null && expected === undefined) return;
  if (
    actual == null ||
    expected === undefined ||
    discussionKey(actual) !== discussionKey(expected) ||
    !bindings ||
    !(await bindings.visible(actual, tenantId))
  )
    throw new DiscussionNotFoundError('Discussion binding is not available');
}
