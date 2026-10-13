export interface IdentityDeletionWork {
  identityId: string;
  revision: number;
  attempts: number;
  tombstone: boolean;
}

export interface IdentityDeletionJobs {
  claim(at: number, token: string): Promise<IdentityDeletionWork | null>;
  complete(uid: string, token: string, at: number): Promise<boolean>;
  failed(
    uid: string,
    token: string,
    attempts: number,
    availableAt: number,
    failedAt: number | null
  ): Promise<void>;
}

export interface IdentityCredentialRemoval {
  /** Removing an already absent provider account succeeds. */
  remove(uid: string): Promise<void>;
}

export class CompleteIdentityDeletion {
  constructor(
    private readonly jobs: IdentityDeletionJobs,
    private readonly credentials: IdentityCredentialRemoval,
    private readonly token: () => string,
    private readonly now: () => number = Date.now
  ) {}

  async once(): Promise<
    'idle' | 'completed' | 'lease-lost' | 'retry' | 'failed'
  > {
    const token = this.token();
    const work = await this.jobs.claim(this.now(), token);
    if (!work) return 'idle';
    const validAttempts =
      Number.isSafeInteger(work.attempts) &&
      work.attempts >= 0 &&
      work.attempts < 12;
    if (
      !work.tombstone ||
      !isCanonicalIdentityId(work.identityId) ||
      !Number.isSafeInteger(work.revision) ||
      work.revision < 1 ||
      !validAttempts
    ) {
      const at = this.now();
      await this.jobs.failed(
        work.identityId,
        token,
        validAttempts ? work.attempts + 1 : 12,
        at,
        at
      );
      return 'failed';
    }
    try {
      await this.credentials.remove(work.identityId);
      return (await this.jobs.complete(work.identityId, token, this.now()))
        ? 'completed'
        : 'lease-lost';
    } catch {
      const attempts = Math.min(work.attempts + 1, 1_000_000);
      const at = this.now();
      const terminal = attempts >= 12;
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
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
