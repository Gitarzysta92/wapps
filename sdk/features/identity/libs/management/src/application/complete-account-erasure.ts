import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import type { IdentityDeletionJobs } from './identity-deletion';
import type { RequestAccountErasure } from './account-erasure';

export interface AccountErasureJobs extends IdentityDeletionJobs {
  defer(uid: string, token: string, availableAt: number): Promise<boolean>;
}

export class CompleteAccountErasure {
  constructor(
    private readonly jobs: AccountErasureJobs,
    private readonly erasure: Pick<RequestAccountErasure, 'request'>,
    private readonly token: () => string,
    private readonly now: () => number = Date.now
  ) {}
  async once(): Promise<
    'idle' | 'completed' | 'lease-lost' | 'pending' | 'retry' | 'failed'
  > {
    const token = this.token(),
      work = await this.jobs.claim(this.now(), token);
    if (!work) return 'idle';
    if (
      !work.tombstone ||
      !isCanonicalIdentityId(work.identityId) ||
      !Number.isSafeInteger(work.revision) ||
      work.revision < 1 ||
      !Number.isSafeInteger(work.attempts) ||
      work.attempts < 0 ||
      work.attempts >= 12
    ) {
      const at = this.now();
      await this.jobs.failed(work.identityId, token, 12, at, at);
      return 'failed';
    }
    try {
      const state = await this.erasure.request({
        identityId: work.identityId,
        revision: work.revision,
      });
      if (state === 'pending')
        return (await this.jobs.defer(
          work.identityId,
          token,
          this.now() + 30_000
        ))
          ? 'pending'
          : 'lease-lost';
      return (await this.jobs.complete(work.identityId, token, this.now()))
        ? 'completed'
        : 'lease-lost';
    } catch {
      const attempts = work.attempts + 1,
        at = this.now(),
        terminal = attempts >= 12;
      await this.jobs.failed(
        work.identityId,
        token,
        attempts,
        at + Math.min(300_000, 1000 * 2 ** Math.min(attempts, 9)),
        terminal ? at : null
      );
      return terminal ? 'failed' : 'retry';
    }
  }
}
