import { DiscussionQueries as KeyedQueries } from '@sdk/features/discussion/libs/management';
import type { DiscussionProjectionReader } from '@sdk/features/discussion/libs/management';
import type { DiscussionTarget } from '@domains/community';
import type {
  DiscussionActor,
  DiscussionWriteRepository,
} from './discussion-write.port';
import type { DiscussionTargets } from './discussion-targets.port';
import { communityDiscussionWrites } from './community-discussion-writes';
import {
  CommunityDiscussionAccess,
  communityDiscussionKey,
} from './community-discussion-binding';
export {
  DiscussionProjectionPendingError,
  type DiscussionProjectionReader,
} from '@sdk/features/discussion/libs/management';

export class DiscussionQueries {
  private readonly engine: KeyedQueries;
  constructor(
    writes: DiscussionWriteRepository,
    projections: DiscussionProjectionReader,
    publicTenant: string,
    targets?: DiscussionTargets
  ) {
    this.engine = new KeyedQueries(
      communityDiscussionWrites(writes),
      projections,
      publicTenant,
      new CommunityDiscussionAccess(targets)
    );
  }
  findAll(actor: DiscussionActor | null) {
    return this.engine.findAll(actor);
  }
  findOne(
    id: string,
    actor: DiscussionActor | null,
    target?: DiscussionTarget,
    rootOnly = false
  ) {
    return this.engine.findOne(
      id,
      actor,
      target ? communityDiscussionKey(target) : undefined,
      rootOnly
    );
  }
}
