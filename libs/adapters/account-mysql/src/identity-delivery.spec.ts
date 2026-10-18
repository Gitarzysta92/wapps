import {
  DispatchIdentityEvents,
  IdentityEventWork,
} from '@sdk/features/identity/libs/authentication';
import {
  CompleteIdentityDeletion,
  IdentityDeletionWork,
} from '@sdk/features/identity/libs/management';

const eventId = '00000000-0000-4000-8000-000000000001';
const envelope = {
  meta: {
    id: eventId,
    type: 'identity.authenticated',
    version: 1,
    occurredAt: '2026-10-11T00:00:00.000Z',
    subject: { entityType: 'identity', entityId: 'Uid' },
  },
  payload: { identityId: 'Uid', revision: 1, provider: 'email' },
};
const event: IdentityEventWork = {
  id: eventId,
  identityId: 'Uid',
  revision: 1,
  eventType: 'identity.authenticated',
  attempts: 0,
  body: JSON.stringify(envelope),
};

function outbox(work: IdentityEventWork | null = event) {
  const store = {
    claim: jest.fn().mockResolvedValue(work),
    delivered: jest.fn().mockResolvedValue(true),
    failed: jest.fn().mockResolvedValue(undefined),
  };
  const publish = jest.fn().mockResolvedValue(undefined);
  return {
    store,
    publish,
    worker: new DispatchIdentityEvents(
      store,
      { publish },
      () => 'lease',
      () => 100
    ),
  };
}

describe('confirmed identity delivery', () => {
  it('leaves an empty journal idle', async () => {
    const f = outbox(null);
    expect(await f.worker.once()).toBe('idle');
    expect(f.publish).not.toHaveBeenCalled();
  });
  it('marks only after the publisher confirms', async () => {
    const f = outbox();
    f.publish.mockImplementation(async () => {
      expect(f.store.delivered).not.toHaveBeenCalled();
    });
    expect(await f.worker.once()).toBe('delivered');
    expect(f.store.delivered).toHaveBeenCalledWith(eventId, 'lease', 100);
  });
  it('retains the same immutable event for replay after confirm/mark crash', async () => {
    const f = outbox();
    f.store.delivered.mockRejectedValueOnce(new Error('SQL disconnected'));
    expect(await f.worker.once()).toBe('retry');
    expect(await f.worker.once()).toBe('delivered');
    expect(f.publish.mock.calls).toEqual([[event.body], [event.body]]);
  });
  it('does not claim success after losing the fence', async () => {
    const f = outbox();
    f.store.delivered.mockResolvedValue(false);
    expect(await f.worker.once()).toBe('lease-lost');
  });
  it('bounds retry and retains exhausted events', async () => {
    const f = outbox({ ...event, attempts: 11 });
    f.publish.mockRejectedValue(new Error('unroutable'));
    expect(await f.worker.once()).toBe('failed');
    expect(f.store.failed).toHaveBeenCalledWith(
      eventId,
      'lease',
      12,
      300100,
      100
    );
    expect(f.store.delivered).not.toHaveBeenCalled();
  });
  it.each([
    { body: '{' },
    { body: 'x'.repeat(16385) },
    { identityId: 'Other' },
    { revision: 2 },
    { eventType: 'other' },
    { attempts: Number.NaN },
    { attempts: 12 },
    {
      body: JSON.stringify({
        ...envelope,
        meta: { ...envelope.meta, occurredAt: 'invalid' },
      }),
    },
  ])('quarantines invalid retained work: %j', async (patch) => {
    const f = outbox({ ...event, ...patch });
    expect(await f.worker.once()).toBe('failed');
    expect(f.publish).not.toHaveBeenCalled();
    expect(f.store.failed.mock.calls[0][4]).toBe(100);
  });
  it('leaves an expiring lease when retry persistence also fails', async () => {
    const f = outbox();
    f.publish.mockRejectedValue(new Error('broker'));
    f.store.failed.mockRejectedValue(new Error('SQL'));
    await expect(f.worker.once()).rejects.toThrow('SQL');
    expect(f.store.delivered).not.toHaveBeenCalled();
  });
});

describe('credential deletion journal', () => {
  const task: IdentityDeletionWork = {
    identityId: 'Uid',
    revision: 2,
    attempts: 0,
    tombstone: true,
  };
  function setup(work: IdentityDeletionWork | null = task) {
    const jobs = {
      claim: jest.fn().mockResolvedValue(work),
      complete: jest.fn().mockResolvedValue(true),
      failed: jest.fn().mockResolvedValue(undefined),
    };
    const remove = jest.fn().mockResolvedValue(undefined);
    return {
      jobs,
      remove,
      worker: new CompleteIdentityDeletion(
        jobs,
        { remove },
        () => 'lease',
        () => 100
      ),
    };
  }
  it('does not call a credential provider with an empty journal', async () => {
    const f = setup(null);
    expect(await f.worker.once()).toBe('idle');
    expect(f.remove).not.toHaveBeenCalled();
  });
  it.each([
    { tombstone: false },
    { identityId: '' },
    { revision: 0 },
    { attempts: 12 },
    { attempts: Number.NaN },
  ])('refuses cleanup without valid retained tombstone: %j', async (patch) => {
    const f = setup({ ...task, ...patch });
    expect(await f.worker.once()).toBe('failed');
    expect(f.remove).not.toHaveBeenCalled();
  });
  it('completes only after remote removal', async () => {
    const f = setup();
    f.remove.mockImplementation(async () => {
      expect(f.jobs.complete).not.toHaveBeenCalled();
    });
    expect(await f.worker.once()).toBe('completed');
    expect(f.jobs.complete).toHaveBeenCalledWith('Uid', 'lease', 100);
  });
  it('repeats idempotent removal after a crash before marking', async () => {
    const f = setup();
    f.jobs.complete.mockRejectedValueOnce(new Error('SQL'));
    expect(await f.worker.once()).toBe('retry');
    expect(await f.worker.once()).toBe('completed');
    expect(f.remove).toHaveBeenCalledTimes(2);
  });
  it('quarantines exhausted remote failures', async () => {
    const f = setup({ ...task, attempts: 11 });
    f.remove.mockRejectedValue(new Error('provider'));
    expect(await f.worker.once()).toBe('failed');
    expect(f.jobs.complete).not.toHaveBeenCalled();
  });
  it('does not complete a replacement lease', async () => {
    const f = setup();
    f.jobs.complete.mockResolvedValue(false);
    expect(await f.worker.once()).toBe('lease-lost');
  });
});
