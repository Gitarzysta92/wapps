import {
  ApplicationImageCleanup,
  type ApplicationImageCleanupStore,
} from './application-image-cleanup';
import type { ApplicationImageRetirementObjects } from './application-image.ports';

describe('durable image cleanup orchestration', () => {
  let store: jest.Mocked<ApplicationImageCleanupStore>;
  let objects: jest.Mocked<ApplicationImageRetirementObjects>;
  const lease = {
    imageId: '019a0010-0000-7000-8000-000000000001',
    token: 'a'.repeat(64),
  };
  beforeEach(() => {
    store = {
      retireUnused: jest.fn().mockResolvedValue(2),
      claim: jest.fn().mockResolvedValue(null),
      complete: jest.fn().mockResolvedValue(true),
      fail: jest.fn().mockResolvedValue('scheduled'),
    };
    objects = { retire: jest.fn().mockResolvedValue(undefined) };
  });
  const service = () => new ApplicationImageCleanup(store, objects, () => 100);
  it('bounds retirement discovery and processes no more than the requested number of objects', async () => {
    store.claim.mockResolvedValue(lease);
    await expect(service().runBatch(2)).resolves.toEqual({
      retired: 2,
      attempted: 2,
      completed: 2,
      scheduled: 0,
      failed: 0,
      unconfirmed: 0,
    });
    expect(store.retireUnused).toHaveBeenCalledWith(100, 50);
    expect(store.claim).toHaveBeenCalledTimes(2);
    expect(objects.retire).toHaveBeenCalledWith(lease.imageId);
  });
  it.each([0, -1, 51, 1.5, NaN])(
    'refuses invalid batch limit %s before any work',
    async (limit) => {
      await expect(service().runBatch(limit)).rejects.toThrow();
      expect(store.retireUnused).not.toHaveBeenCalled();
    }
  );
  it('records completion only after object retirement', async () => {
    store.claim.mockResolvedValueOnce(lease);
    store.complete.mockImplementation(async () => {
      expect(objects.retire).toHaveBeenCalledTimes(1);
      return true;
    });
    expect((await service().runBatch()).completed).toBe(1);
    expect(store.fail).not.toHaveBeenCalled();
  });
  it.each(['scheduled', 'failed', 'stale'] as const)(
    'reports storage failure only through its durable %s outcome',
    async (result) => {
      store.claim.mockResolvedValueOnce(lease);
      objects.retire.mockRejectedValue(new Error('storage unavailable'));
      store.fail.mockResolvedValue(result);
      const report = await service().runBatch();
      expect(report[result === 'stale' ? 'unconfirmed' : result]).toBe(1);
      expect(report.completed).toBe(0);
      expect(store.complete).not.toHaveBeenCalled();
      expect(store.fail).toHaveBeenCalledWith(lease, 100);
    }
  );
  it('leaves unconfirmed receipts recoverable by the durable lease', async () => {
    store.claim.mockResolvedValueOnce(lease);
    store.complete.mockRejectedValue(new Error('lost SQL response'));
    store.fail.mockRejectedValue(new Error('database unavailable'));
    expect((await service().runBatch()).unconfirmed).toBe(1);
  });
  it('never claims completion for a replaced or expired lease', async () => {
    store.claim.mockResolvedValueOnce(lease);
    store.complete.mockResolvedValue(false);
    const report = await service().runBatch();
    expect(report.completed).toBe(0);
    expect(report.unconfirmed).toBe(1);
    expect(store.fail).not.toHaveBeenCalled();
  });
  it('stops before object I/O when canonical retirement cannot be confirmed', async () => {
    store.retireUnused.mockRejectedValue(new Error('SQL unavailable'));
    await expect(service().runBatch()).rejects.toThrow('SQL unavailable');
    expect(store.claim).not.toHaveBeenCalled();
    expect(objects.retire).not.toHaveBeenCalled();
  });
});
