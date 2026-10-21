import {
  ACCOUNT_EXPORT_LIMITS,
  consumerProviderPlan,
  AccountExportLeaseLost,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
  parseAccountExportArtifact,
} from '@sdk/features/identity/core';
import type {
  AccountExportArchive,
  AccountExportJobs,
  AccountExportSource,
} from './ports/account-export.port';

export class CompleteAccountExport {
  private readonly required: readonly string[];
  constructor(
    private readonly jobs: AccountExportJobs,
    private readonly sources: readonly AccountExportSource[],
    private readonly archive: AccountExportArchive,
    private readonly token: () => string,
    private readonly now: () => number,
    required: readonly string[]
  ) {
    this.required = consumerProviderPlan(required);
    this.sources = Object.freeze(
      sources.map((source) =>
        Object.freeze({
          name: source.name,
          capture: source.capture.bind(source),
        })
      )
    );
    if (
      sources.length !== this.required.length ||
      sources.some((source, index) => source.name !== this.required[index])
    )
      throw new Error(
        'Every canonical account export source is required in order'
      );
  }

  async once(
    shutdown?: AbortSignal
  ): Promise<'idle' | 'completed' | 'retry' | 'failed' | 'lease-lost'> {
    if (shutdown?.aborted) return 'idle';
    await this.jobs.purge(this.now());
    const work = await this.jobs.claim(this.now(), this.token());
    if (!work) return 'idle';
    const startedAt = this.now();
    const controller = new AbortController();
    const { signal } = controller;
    const stop = () => controller.abort(new AccountExportLeaseLost());
    shutdown?.addEventListener('abort', stop, { once: true });
    if (shutdown?.aborted) stop();
    const timeout = setTimeout(
      () =>
        controller.abort(
          new AccountExportLimitExceeded('Account export capture timed out')
        ),
      ACCOUNT_EXPORT_LIMITS.attemptMs
    );
    let renewal: Promise<void> | undefined;
    const heartbeat = (): Promise<void> => {
      signal.throwIfAborted();
      if (!renewal)
        renewal = (async () => {
          if (this.now() >= work.expiresAt) throw new AccountExportLeaseLost();
          if (this.now() - startedAt >= ACCOUNT_EXPORT_LIMITS.attemptMs)
            throw new AccountExportLimitExceeded(
              'Account export capture timed out'
            );
          if (!(await this.jobs.heartbeat(work, this.now())))
            throw new AccountExportLeaseLost();
          signal.throwIfAborted();
        })().finally(() => {
          renewal = undefined;
        });
      return renewal;
    };
    const timer = setInterval(() => {
      if (!signal.aborted)
        void heartbeat().catch((error) => controller.abort(error));
    }, ACCOUNT_EXPORT_LIMITS.leaseMs / 3);
    let onAbort: () => void = () => undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    void aborted.catch(() => undefined);
    try {
      // Cancellation releases a stuck source; a late callback cannot publish or append.
      const artifact = parseAccountExportArtifact(
        await Promise.race([
          this.archive.build(
            work.identityId,
            this.sources,
            async (index, bytes) => {
              signal.throwIfAborted();
              await heartbeat();
              signal.throwIfAborted();
              if (!(await this.jobs.append(work, index, bytes, this.now())))
                throw new AccountExportLeaseLost();
              signal.throwIfAborted();
            },
            signal
          ),
          aborted,
        ]),
        this.required
      );
      await Promise.race([heartbeat(), aborted]);
      signal.throwIfAborted();
      return (await this.jobs.complete(work, artifact, this.now()))
        ? 'completed'
        : 'lease-lost';
    } catch (error) {
      controller.abort(error);
      if (error instanceof AccountExportLeaseLost) return 'lease-lost';
      const failure =
        error instanceof AccountExportLimitExceeded
          ? 'limit-exceeded'
          : error instanceof AccountExportSourceInvalid
          ? 'invalid-source'
          : error instanceof CanonicalIdentityAccessDenied
          ? 'account-unavailable'
          : 'source-unavailable';
      const terminal =
        failure !== 'source-unavailable' ||
        work.attempts >= ACCOUNT_EXPORT_LIMITS.attempts;
      await this.jobs.failed(work, failure, this.now(), terminal);
      return terminal ? 'failed' : 'retry';
    } finally {
      clearInterval(timer);
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      shutdown?.removeEventListener('abort', stop);
      stop();
    }
  }
}
