import {
  discussionSelectionQuery,
  parseDiscussionSelection,
  type DiscussionSelectionItem,
  type PublicApplicationDiscussion,
} from '@sdk/features/discussion/core';
import { DiscussionProjectionPendingError } from './discussion-queries';
import {
  DiscussionNotFoundError,
  type DiscussionResource,
  type DiscussionWriteRepository,
} from './discussion-write.port';
import {
  assertDiscussionTarget,
  type DiscussionTargets,
} from './discussion-targets.port';

export interface SelectedDiscussionReader {
  read(
    applicationId: string,
    id: string,
    actor: null,
    rootOnly: boolean
  ): Promise<PublicApplicationDiscussion>;
}

/** Public-topic resolution does not accept an account, tenant or a caller-selected parent. */
export class PublicDiscussionSelection {
  constructor(
    private readonly writes: Pick<DiscussionWriteRepository, 'resource'>,
    private readonly reader: SelectedDiscussionReader,
    private readonly targets: DiscussionTargets,
    private readonly publicTenant: string
  ) {}

  async select(query: unknown) {
    const ids = discussionSelectionQuery(query);
    const loaded: DiscussionSelectionItem[] = [];
    for (const id of ids) {
      const resource = await this.writes.resource(id);
      if (!this.visibleRoot(resource)) continue;
      try {
        const thread = await this.reader.read(
          resource.target.id,
          id,
          null,
          true
        );
        if (thread.id !== id) throw new Error('Invalid selected discussion');
        loaded.push({
          id,
          applicationId: resource.target.id,
          revision: thread.revision,
          title: thread.title,
          replyCount: thread.replyCount,
        });
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    const items: DiscussionSelectionItem[] = [];
    for (const item of loaded) {
      const current = await this.writes.resource(item.id);
      if (!this.visibleRoot(current)) continue;
      if (
        current.target.id !== item.applicationId ||
        current.revision !== item.revision
      )
        throw new DiscussionProjectionPendingError(
          'Discussion selection changed while loading'
        );
      try {
        await assertDiscussionTarget(
          current.target,
          current.target,
          this.publicTenant,
          this.targets
        );
        items.push(item);
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    return parseDiscussionSelection({ items }, ids);
  }

  private visibleRoot(
    resource: DiscussionResource | null
  ): resource is DiscussionResource & {
    target: { kind: 'application'; id: string };
  } {
    return (
      !!resource &&
      resource.kind === 'discussion' &&
      resource.id === resource.discussionId &&
      resource.tenantId === this.publicTenant &&
      resource.target?.kind === 'application' &&
      resource.state === 'published' &&
      resource.visibility === 'public' &&
      resource.deletedAt === null &&
      resource.rootState === 'published' &&
      resource.rootVisibility === 'public' &&
      resource.rootDeletedAt === null
    );
  }
}
