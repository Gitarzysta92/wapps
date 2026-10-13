import {
  DispatchEditorialOutbox,
  EditorialOutbox,
  EditorialOutboxItem,
} from './editorial-outbox';

const item: EditorialOutboxItem = {
  id: '1',
  attempts: 0,
  kind: 'app',
  resourceId: '019a0010-0000-7000-8000-000000000001',
  tenantId: 'default',
  revision: '3',
  createdAt: '100',
};

function fixture() {
  const outbox: jest.Mocked<EditorialOutbox> = {
    claim: jest.fn().mockResolvedValue(item),
    delivered: jest.fn().mockResolvedValue(true),
    failed: jest.fn().mockResolvedValue(undefined),
  };
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const dispatch = new DispatchEditorialOutbox(
    outbox,
    publisher,
    () => 'lease',
    () => 200
  );
  return { outbox, publisher, dispatch };
}

describe('Editorial durable outbox dispatch', () => {
  it('dispatches suite publication through the same durable event contract', async () => {
    const f = fixture();
    f.outbox.claim.mockResolvedValue({ ...item, kind: 'suite' });
    expect(await f.dispatch.once()).toBe('delivered');
    expect(f.publisher.publish.mock.calls[0][0].payload).toEqual({
      kind: 'suite',
      resourceId: item.resourceId,
      tenantId: 'default',
      revision: 3,
    });
  });
  it('does no work when there are no eligible requests', async () => {
    const f = fixture();
    f.outbox.claim.mockResolvedValue(null);
    expect(await f.dispatch.once()).toBe('idle');
    expect(f.publisher.publish).not.toHaveBeenCalled();
  });

  it('waits for confirmed publication before marking the retained SQL request delivered', async () => {
    const f = fixture();
    let confirm: () => void = () => undefined;
    const publishing = new Promise<void>((resolve) => {
      confirm = resolve;
    });
    f.publisher.publish.mockReturnValue(publishing);
    const dispatched = f.dispatch.once();
    await Promise.resolve();
    expect(f.publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          id: 'editorial-outbox:1',
          version: 1,
          type: 'editorial.materialization.requested',
        }),
        payload: {
          kind: 'app',
          resourceId: item.resourceId,
          tenantId: 'default',
          revision: 3,
        },
      })
    );
    expect(f.outbox.delivered).not.toHaveBeenCalled();
    confirm();
    expect(await dispatched).toBe('delivered');
    expect(f.outbox.delivered).toHaveBeenCalledWith('1', 'lease', 200);
  });

  it('retains a request after an unknown broker confirmation outcome', async () => {
    const f = fixture();
    f.publisher.publish.mockRejectedValue(new Error('confirmation lost'));
    expect(await f.dispatch.once()).toBe('retry');
    expect(f.outbox.delivered).not.toHaveBeenCalled();
    expect(f.outbox.failed).toHaveBeenCalledWith('1', 'lease', 1, 2200, null);
  });

  it('replays the same event identity after confirmation followed by a SQL marking failure', async () => {
    const f = fixture();
    f.outbox.delivered.mockRejectedValueOnce(new Error('SQL disconnected'));
    expect(await f.dispatch.once()).toBe('retry');
    expect(await f.dispatch.once()).toBe('delivered');
    expect(f.publisher.publish.mock.calls[0][0]).toEqual(
      f.publisher.publish.mock.calls[1][0]
    );
  });

  it('does not overwrite another dispatcher after its lease has been replaced', async () => {
    const f = fixture();
    f.outbox.delivered.mockResolvedValue(false);
    expect(await f.dispatch.once()).toBe('lease-lost');
    expect(f.outbox.failed).not.toHaveBeenCalled();
  });

  it('leaves an expiring lease for restart recovery when even retry persistence is unavailable', async () => {
    const f = fixture();
    f.publisher.publish.mockRejectedValue(new Error('broker unavailable'));
    f.outbox.failed.mockRejectedValue(new Error('SQL unavailable'));
    await expect(f.dispatch.once()).rejects.toThrow('SQL unavailable');
    expect(f.outbox.delivered).not.toHaveBeenCalled();
  });

  it('bounds retry delay and quarantines requests after twelve failed attempts', async () => {
    const f = fixture();
    f.outbox.claim.mockResolvedValue({ ...item, attempts: 11 });
    f.publisher.publish.mockRejectedValue(new Error('unavailable'));
    expect(await f.dispatch.once()).toBe('failed');
    expect(f.outbox.failed).toHaveBeenCalledWith('1', 'lease', 12, 300200, 200);
  });

  it.each([
    { kind: 'unknown' },
    { resourceId: 'malformed' },
    { tenantId: '' },
    { revision: 0 },
    { revision: Number.MAX_SAFE_INTEGER + 1 },
    { createdAt: null },
    { createdAt: -1 },
  ])(
    'quarantines invalid committed requests without publishing %#',
    async (invalid) => {
      const f = fixture();
      f.outbox.claim.mockResolvedValue({ ...item, ...invalid });
      expect(await f.dispatch.once()).toBe('failed');
      expect(f.publisher.publish).not.toHaveBeenCalled();
      expect(f.outbox.failed).toHaveBeenCalledWith('1', 'lease', 1, 2200, 200);
    }
  );
});
