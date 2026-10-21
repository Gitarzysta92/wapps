import {
  commentObject,
  myDiscussionCursor,
  type MyDiscussion,
  type MyDiscussionCursor,
  type MyDiscussionPage,
  type PublicApplicationDiscussion,
} from '@domains/community';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
} from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';

export interface MyDiscussionCandidate extends MyDiscussionCursor {
  applicationId: string;
  revision: number;
  participation: MyDiscussion['participation'];
}

/** Membership and visibility are read from current SQL authority, never a projection. */
export interface MyDiscussionIndex {
  list(
    actor: DiscussionActor,
    cursor: MyDiscussionCursor | null
  ): Promise<MyDiscussionCandidate[]>;
  current(
    actor: DiscussionActor,
    ids: string[]
  ): Promise<MyDiscussionCandidate[]>;
}

export interface MyDiscussionReader {
  read(
    applicationId: string,
    id: string,
    actor: DiscussionActor,
    rootOnly: boolean
  ): Promise<PublicApplicationDiscussion>;
}

export class MyDiscussions {
  constructor(
    private readonly index: MyDiscussionIndex,
    private readonly discussions: MyDiscussionReader,
    private readonly policy: IPolicyEvaluator
  ) {}

  async list(
    actor: DiscussionActor,
    query: unknown
  ): Promise<MyDiscussionPage> {
    const action = 'discussion.my-topics.read';
    if (!actor.identityId?.trim() || !actor.tenantId?.trim())
      throw new PermissionDeniedError(action);
    const permission = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: { roles: actor.roles },
      resource: {
        type: 'my-discussion-workspace',
        id: actor.identityId,
        tenantId: actor.tenantId,
      },
    });
    if (!permission.ok) throw permission.error;
    if (permission.value !== true) throw new PermissionDeniedError(action);
    const input = commentObject(query, ['cursor']);
    const cursor =
      input['cursor'] === undefined
        ? null
        : myDiscussionCursor(input['cursor']);
    const candidates = await this.index.list(actor, cursor);
    if (
      candidates.length > 11 ||
      new Set(candidates.map((row) => row.id)).size !== candidates.length
    )
      throw new Error('Invalid discussion participation page');
    const loaded: Array<{ entry: MyDiscussion; revision: number }> = [];
    // Examine at most ten candidates; hidden parents may leave a short or empty page with a cursor.
    for (const candidate of candidates.slice(0, 10)) {
      try {
        const thread = await this.discussions.read(
          candidate.applicationId,
          candidate.id,
          actor,
          true
        );
        loaded.push({
          entry: {
            id: candidate.id,
            applicationId: candidate.applicationId,
            title: thread.title,
            createdAt: candidate.at,
            replyCount: thread.replyCount,
            participation: candidate.participation,
          },
          revision: thread.revision,
        });
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    const current = new Map(
      (
        await this.index.current(
          actor,
          loaded.map(({ entry }) => entry.id)
        )
      ).map((row) => [row.id, row])
    );
    const items: MyDiscussion[] = [];
    for (const { entry, revision } of loaded) {
      const authority = current.get(entry.id);
      if (!authority) continue;
      if (
        authority.applicationId !== entry.applicationId ||
        authority.revision !== revision
      )
        throw new DiscussionProjectionPendingError(
          'Discussion participation changed while loading'
        );
      items.push({ ...entry, participation: authority.participation });
    }
    const last = candidates[9];
    return {
      items,
      next: candidates.length > 10 ? `${last.at}.${last.id}` : null,
    };
  }
}
