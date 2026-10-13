import { applicationImageInteger } from '@domains/catalog/media';
import type { ApplicationImageRetirementObjects } from './application-image.ports';

export interface ApplicationImageCleanupLease {
  imageId: string;
  token: string;
}
export interface ApplicationImageCleanupStore {
  retireUnused(at: number, limit: number): Promise<number>;
  claim(at: number): Promise<ApplicationImageCleanupLease | null>;
  complete(lease: ApplicationImageCleanupLease, at: number): Promise<boolean>;
  fail(
    lease: ApplicationImageCleanupLease,
    at: number
  ): Promise<'scheduled' | 'failed' | 'stale'>;
}

export class ApplicationImageCleanup {
  constructor(
    private readonly store: ApplicationImageCleanupStore,
    private readonly objects: ApplicationImageRetirementObjects,
    private readonly now: () => number = Date.now
  ) {}
  async runBatch(limit = 20) {
    applicationImageInteger(limit, 50);
    const retired = await this.store.retireUnused(this.now(), 50);
    const report = {
      retired,
      attempted: 0,
      completed: 0,
      scheduled: 0,
      failed: 0,
      unconfirmed: 0,
    };
    for (let index = 0; index < limit; index++) {
      const lease = await this.store.claim(this.now());
      if (!lease) break;
      report.attempted++;
      try {
        await this.objects.retire(lease.imageId);
        if (await this.store.complete(lease, this.now())) report.completed++;
        else report.unconfirmed++;
      } catch {
        try {
          const result = await this.store.fail(lease, this.now());
          if (result === 'stale') report.unconfirmed++;
          else report[result]++;
        } catch {
          // The durable lease recovers after expiry when a failure receipt cannot be confirmed.
          report.unconfirmed++;
        }
      }
    }
    return report;
  }
}
