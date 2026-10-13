import {
  accountErasureRequest,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';

export interface DiscussionProjectionErasureTarget {
  nodeId: string;
  discussionId: string;
  revision: number;
}
export interface DiscussionProjectionErasureRepository {
  next(
    request: AccountErasureRequest
  ): Promise<DiscussionProjectionErasureTarget | null>;
  complete(
    request: AccountErasureRequest,
    target: DiscussionProjectionErasureTarget
  ): Promise<void>;
}
export interface DiscussionProjectionErasureStore {
  /** A current anonymous stable record must survive deletion of historical copies. */
  purge(target: DiscussionProjectionErasureTarget): Promise<boolean>;
  /** Remove obsolete formats, including orphaned legacy records that cannot prove ownership. */
  purgeLegacyBatch(): Promise<boolean>;
  assertNoAttribution(identityId: string): Promise<void>;
}

/** Completion here covers only projections; private SQL/object cleanup still owns the service receipt. */
export class EraseDiscussionProjections {
  constructor(
    private readonly repository: DiscussionProjectionErasureRepository,
    private readonly projections: DiscussionProjectionErasureStore,
    private readonly oldWorkersStopped: boolean
  ) {}

  async advance(input: AccountErasureRequest): Promise<'pending' | 'drained'> {
    const request = accountErasureRequest(input);
    if (!this.oldWorkersStopped)
      throw new Error(
        'Drain and fence old Discussion materializers before projection erasure'
      );
    const target = await this.repository.next(request);
    if (target) {
      if (await this.projections.purge(target))
        await this.repository.complete(request, target);
      return 'pending';
    }
    if (await this.projections.purgeLegacyBatch()) return 'pending';
    await this.projections.assertNoAttribution(request.identityId);
    return 'drained';
  }
}
