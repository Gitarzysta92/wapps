import { CompleteAccountErasure } from './complete-account-erasure';

describe('durable account erasure coordinator worker', () => {
  function fixture() {
    const work = {
      identityId: 'Member',
      revision: 7,
      attempts: 0,
      tombstone: true,
    };
    const jobs = {
      claim: jest.fn().mockResolvedValue(work),
      defer: jest.fn().mockResolvedValue(true),
      complete: jest.fn().mockResolvedValue(true),
      failed: jest.fn().mockResolvedValue(undefined),
    };
    const erasure = { request: jest.fn().mockResolvedValue('pending') };
    return {
      jobs,
      erasure,
      work,
      worker: new CompleteAccountErasure(
        jobs,
        erasure,
        () => 'lease',
        () => 1000
      ),
    };
  }
  it('does nothing when no work is available', async () => {
    const f = fixture();
    f.jobs.claim.mockResolvedValue(null);
    expect(await f.worker.once()).toBe('idle');
    expect(f.erasure.request).not.toHaveBeenCalled();
  });
  it('defers normal pending work without exhausting the error retry budget', async () => {
    const f = fixture();
    f.work.attempts = 11;
    expect(await f.worker.once()).toBe('pending');
    expect(f.jobs.defer).toHaveBeenCalledWith('Member', 'lease', 31000);
    expect(f.jobs.failed).not.toHaveBeenCalled();
    expect(f.jobs.complete).not.toHaveBeenCalled();
  });
  it('records completion only after all participants complete', async () => {
    const f = fixture();
    f.erasure.request.mockResolvedValue('completed');
    expect(await f.worker.once()).toBe('completed');
    expect(f.erasure.request).toHaveBeenCalledWith({
      identityId: 'Member',
      revision: 7,
    });
    expect(f.jobs.complete).toHaveBeenCalledWith('Member', 'lease', 1000);
  });
  it.each(['pending', 'completed'])(
    'reports lost ownership while storing %s',
    async (state) => {
      const f = fixture();
      f.erasure.request.mockResolvedValue(state);
      f.jobs.defer.mockResolvedValue(false);
      f.jobs.complete.mockResolvedValue(false);
      expect(await f.worker.once()).toBe('lease-lost');
    }
  );
  it('retries outages with backoff and quarantines the twelfth failure', async () => {
    const f = fixture();
    f.erasure.request.mockRejectedValue(new Error('offline'));
    expect(await f.worker.once()).toBe('retry');
    expect(f.jobs.failed).toHaveBeenLastCalledWith(
      'Member',
      'lease',
      1,
      3000,
      null
    );
    f.work.attempts = 11;
    expect(await f.worker.once()).toBe('failed');
    expect(f.jobs.failed).toHaveBeenLastCalledWith(
      'Member',
      'lease',
      12,
      301000,
      1000
    );
    expect(f.jobs.complete).not.toHaveBeenCalled();
  });
  it.each([
    { tombstone: false },
    { identityId: '' },
    { revision: 0 },
    { revision: 1.2 },
    { attempts: -1 },
    { attempts: 12 },
  ])(
    'quarantines invalid authority before contacting services: %j',
    async (change) => {
      const f = fixture();
      f.jobs.claim.mockResolvedValue({ ...f.work, ...change });
      expect(await f.worker.once()).toBe('failed');
      expect(f.erasure.request).not.toHaveBeenCalled();
    }
  );
});
