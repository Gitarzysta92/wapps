import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportLeaseLost,
  AccountExportLimitExceeded,
  AccountExportSourceInvalid,
  CanonicalIdentityAccessDenied,
} from '@sdk/features/identity/core';
import { ACCOUNT_EXPORT_SOURCES } from './account-provider-plan';
import type {
  AccountExportArchive,
  AccountExportWork,
} from '@sdk/features/identity/libs/management';
import { CompleteAccountExport } from './complete-account-export';

const id = '00000000-0000-4000-8000-000000000001';
const token = '00000000-0000-4000-8000-000000000002';
function fixture() {
  const work: AccountExportWork = {
    id,
    identityId: 'Member',
    token,
    attempts: 1,
    expiresAt: 1000 + ACCOUNT_EXPORT_LIMITS.retentionMs,
  };
  const artifact = {
    bytes: 100,
    sha256: 'a'.repeat(64),
    chunks: 1,
    captures: ACCOUNT_EXPORT_SOURCES.map((source) => ({
      source,
      startedAt: 1000,
      completedAt: 1001,
      records: 0,
    })),
  };
  const jobs = {
    purge: jest.fn().mockResolvedValue(undefined),
    claim: jest.fn().mockResolvedValue(work),
    heartbeat: jest.fn().mockResolvedValue(true),
    append: jest.fn().mockResolvedValue(true),
    complete: jest.fn().mockResolvedValue(true),
    failed: jest.fn().mockResolvedValue(undefined),
  };
  const sources = ACCOUNT_EXPORT_SOURCES.map((name) => ({
    name,
    async *capture() {
      /* Archive mock controls capture. */
    },
  }));
  const build = jest
    .fn<
      ReturnType<AccountExportArchive['build']>,
      Parameters<AccountExportArchive['build']>
    >()
    .mockResolvedValue(artifact);
  const worker = new CompleteAccountExport(
    jobs,
    sources,
    { build },
    () => token
  );
  return { work, artifact, jobs, sources, build, worker };
}

describe('durable account export worker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
  });
  afterEach(() => {
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
  it('requires every source, in a deterministic order', () => {
    const f = fixture();
    expect(
      () =>
        new CompleteAccountExport(
          f.jobs,
          f.sources.slice(1),
          { build: f.build },
          () => token
        )
    ).toThrow('Every canonical');
    expect(
      () =>
        new CompleteAccountExport(
          f.jobs,
          [...f.sources].reverse(),
          { build: f.build },
          () => token
        )
    ).toThrow('Every canonical');
  });
  it('purges abandoned payloads before checking for available work', async () => {
    const f = fixture();
    f.jobs.claim.mockResolvedValue(null);
    expect(await f.worker.once()).toBe('idle');
    expect(f.jobs.purge.mock.invocationCallOrder[0]).toBeLessThan(
      f.jobs.claim.mock.invocationCallOrder[0]
    );
    expect(f.build).not.toHaveBeenCalled();
  });
  it('completes only validated artifacts under a current lease', async () => {
    const f = fixture();
    f.build.mockImplementation(async (_uid, _sources, write, signal) => {
      expect(signal.aborted).toBe(false);
      await write(0, new Uint8Array([1]));
      return f.artifact;
    });
    expect(await f.worker.once()).toBe('completed');
    expect(f.jobs.append).toHaveBeenCalledWith(
      f.work,
      0,
      new Uint8Array([1]),
      1000
    );
    expect(f.jobs.complete).toHaveBeenCalledWith(f.work, f.artifact, 1000);
  });
  it.each([
    [new Error('source down'), 'retry', 'source-unavailable', false],
    [new AccountExportLimitExceeded(), 'failed', 'limit-exceeded', true],
    [new AccountExportSourceInvalid(), 'failed', 'invalid-source', true],
    [
      new CanonicalIdentityAccessDenied(),
      'failed',
      'account-unavailable',
      true,
    ],
  ] as const)(
    'handles source failure %p without exposing partial data',
    async (error, outcome, failure, terminal) => {
      const f = fixture();
      f.build.mockRejectedValue(error);
      expect(await f.worker.once()).toBe(outcome);
      expect(f.jobs.failed).toHaveBeenCalledWith(
        f.work,
        failure,
        1000,
        terminal
      );
      expect(f.jobs.complete).not.toHaveBeenCalled();
      expect(f.build.mock.calls[0][3].aborted).toBe(true);
    }
  );
  it('does not retry source outages forever', async () => {
    const f = fixture();
    f.work.attempts = ACCOUNT_EXPORT_LIMITS.attempts;
    f.build.mockRejectedValue(new Error('offline'));
    expect(await f.worker.once()).toBe('failed');
    expect(f.jobs.failed).toHaveBeenCalledWith(
      f.work,
      'source-unavailable',
      1000,
      true
    );
  });
  it('rejects an incomplete artifact before ready transition', async () => {
    const f = fixture();
    f.artifact.captures.pop();
    expect(await f.worker.once()).toBe('failed');
    expect(f.jobs.complete).not.toHaveBeenCalled();
  });
  it('aborts a stalled source and releases the worker at the attempt deadline', async () => {
    const f = fixture();
    f.build.mockImplementation(() => new Promise(() => undefined));
    const result = f.worker.once();
    await jest.advanceTimersByTimeAsync(ACCOUNT_EXPORT_LIMITS.attemptMs);
    expect(await result).toBe('failed');
    expect(f.jobs.failed).toHaveBeenCalledWith(
      f.work,
      'limit-exceeded',
      expect.any(Number),
      true
    );
    expect(f.jobs.heartbeat).toHaveBeenCalled();
    expect(f.build.mock.calls[0][3].aborted).toBe(true);
    await expect(
      f.build.mock.calls[0][2](0, new Uint8Array([1]))
    ).rejects.toBeInstanceOf(AccountExportLimitExceeded);
    expect(f.jobs.append).not.toHaveBeenCalled();
  });
  it('aborts a stalled renewal without waiting for its response', async () => {
    const f = fixture();
    f.build.mockImplementation(() => new Promise(() => undefined));
    f.jobs.heartbeat.mockImplementation(() => new Promise(() => undefined));
    const result = f.worker.once();
    await jest.advanceTimersByTimeAsync(ACCOUNT_EXPORT_LIMITS.attemptMs);
    expect(await result).toBe('failed');
    expect(f.jobs.heartbeat).toHaveBeenCalledTimes(1);
  });
  it.each([false, new AccountExportLeaseLost()])(
    'never changes a job owned by a different worker: %p',
    async (failure) => {
      const f = fixture();
      if (failure === false) f.jobs.heartbeat.mockResolvedValue(false);
      else f.build.mockRejectedValue(failure);
      expect(await f.worker.once()).toBe('lease-lost');
      expect(f.jobs.failed).not.toHaveBeenCalled();
      expect(f.jobs.complete).not.toHaveBeenCalled();
    }
  );
  it('cancels a source on lifecycle rejection while it is stalled', async () => {
    const f = fixture();
    f.build.mockImplementation(() => new Promise(() => undefined));
    f.jobs.heartbeat.mockRejectedValue(new CanonicalIdentityAccessDenied());
    const result = f.worker.once();
    await jest.advanceTimersByTimeAsync(ACCOUNT_EXPORT_LIMITS.leaseMs / 3);
    expect(await result).toBe('failed');
    expect(f.jobs.failed).toHaveBeenCalledWith(
      f.work,
      'account-unavailable',
      expect.any(Number),
      true
    );
  });
  it('leaves a shutdown capture reclaimable and prevents late writes', async () => {
    const f = fixture();
    f.build.mockImplementation(() => new Promise(() => undefined));
    const shutdown = new AbortController();
    const result = f.worker.once(shutdown.signal);
    await jest.advanceTimersByTimeAsync(0);
    shutdown.abort();
    expect(await result).toBe('lease-lost');
    await expect(
      f.build.mock.calls[0][2](0, new Uint8Array([1]))
    ).rejects.toBeInstanceOf(AccountExportLeaseLost);
    expect(f.jobs.failed).not.toHaveBeenCalled();
    expect(f.jobs.append).not.toHaveBeenCalled();
  });
  it('does not claim work after shutdown', async () => {
    const f = fixture(),
      shutdown = new AbortController();
    shutdown.abort();
    expect(await f.worker.once(shutdown.signal)).toBe('idle');
    expect(f.jobs.claim).not.toHaveBeenCalled();
  });
});
