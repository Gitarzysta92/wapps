import {
  accountErasureRequest,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import type { AccountErasureCleanup } from '@sdk/features/identity/libs/management';

export interface DiscussionErasureCompletion {
  state(request: AccountErasureRequest): Promise<'pending' | 'completed'>;
  /** Recheck all remaining SQL authority and record the exact durable receipt atomically. */
  complete(request: AccountErasureRequest): Promise<'pending' | 'completed'>;
}

interface Phase<T> {
  advance(request: AccountErasureRequest): Promise<T>;
}

export class CleanDiscussionAccount implements AccountErasureCleanup {
  constructor(
    private readonly contributions: Phase<boolean>,
    private readonly payloads: Phase<number>,
    private readonly privateData: Phase<'pending' | 'drained'>,
    private readonly reviews: Phase<'pending' | 'drained'>,
    private readonly projections: Phase<'pending' | 'drained'>,
    private readonly completion: DiscussionErasureCompletion,
    private readonly oldWorkersFenced: boolean
  ) {}

  async advance(
    input: AccountErasureRequest
  ): Promise<'pending' | 'completed'> {
    const request = accountErasureRequest(input);
    if ((await this.completion.state(request)) === 'completed')
      return 'completed';
    if (!this.oldWorkersFenced) return 'pending';
    try {
      if (await this.contributions.advance(request)) return 'pending';
      if ((await this.payloads.advance(request)) > 0) return 'pending';
      if ((await this.privateData.advance(request)) === 'pending')
        return 'pending';
      if ((await this.reviews.advance(request)) === 'pending') return 'pending';
      if ((await this.projections.advance(request)) === 'pending')
        return 'pending';
      return await this.completion.complete(request);
    } catch (error) {
      // A concurrent invocation may finish while this call awaits object/projection I/O.
      if ((await this.completion.state(request)) === 'completed')
        return 'completed';
      throw error;
    }
  }
}
