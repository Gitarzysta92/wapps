import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import {
  DeliverReplyNotifications,
  ReplyInboxService,
  type ReplyInboxStore,
  type ReplyNotificationSource,
} from './reply-notifications';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const event = {
  id: id(2),
  discussionId: id(1),
  parentId: id(1),
  recipientId: 'Owner',
  revision: 2,
  at: 100,
};
const target = {
  id: id(2),
  discussionId: id(1),
  target: { kind: 'application' as const, id: id(3) },
  title: 'Application',
  slug: 'application',
};
const ctx = { identityId: 'Owner', timestamp: 1, subject: { roles: [] } };
const page = { revision: 3, enabled: true, entries: [{ event, readAt: null }] };

function fixture() {
  const source: jest.Mocked<ReplyNotificationSource> = {
    claim: jest.fn().mockResolvedValue({ event, token: id(4), until: 200 }),
    settle: jest.fn().mockResolvedValue(undefined),
    resolve: jest.fn().mockResolvedValue([target]),
  };
  const store: jest.Mocked<ReplyInboxStore> = {
    receive: jest.fn().mockResolvedValue('delivered'),
    list: jest.fn().mockResolvedValue(page),
    current: jest.fn().mockResolvedValue(page),
    markRead: jest.fn().mockResolvedValue({ id: id(2), readAt: 200 }),
  };
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  return {
    store,
    source,
    evaluate,
    worker: new DeliverReplyNotifications(source, store),
    service: new ReplyInboxService(authority, store, source),
  };
}

describe('durable reply delivery', () => {
  it('acknowledges only after the recipient has a durable receipt', async () => {
    const f = fixture();
    expect(await f.worker.advance()).toBe(true);
    expect(f.store.receive).toHaveBeenCalledWith(event, true);
    expect(f.source.settle).toHaveBeenCalledWith(event.id, id(4), false);
    expect(f.store.receive.mock.invocationCallOrder[0]).toBeLessThan(
      f.source.settle.mock.invocationCallOrder[0]
    );
  });
  it('records suppression for removed sources before acknowledgement', async () => {
    const f = fixture();
    f.source.resolve.mockResolvedValue([]);
    f.store.receive.mockResolvedValue('suppressed');
    expect(await f.worker.advance()).toBe(true);
    expect(f.store.receive).toHaveBeenCalledWith(event, false);
    expect(f.source.settle).toHaveBeenCalledWith(event.id, id(4), false);
  });
  it('defers failed delivery without acknowledging it and does not write on mismatched source scope', async () => {
    const f = fixture();
    f.source.resolve.mockResolvedValue([{ ...target, discussionId: id(9) }]);
    await expect(f.worker.advance()).rejects.toThrow('scope');
    expect(f.store.receive).not.toHaveBeenCalled();
    expect(f.source.settle).toHaveBeenCalledTimes(1);
    expect(f.source.settle).toHaveBeenCalledWith(event.id, id(4), true);
  });
  it('reuses the immutable event after a lost acknowledgement', async () => {
    const f = fixture();
    f.source.settle.mockRejectedValueOnce(new Error('lost acknowledgement'));
    await expect(f.worker.advance()).rejects.toThrow('lost acknowledgement');
    expect(await f.worker.advance()).toBe(true);
    expect(f.store.receive.mock.calls).toEqual([
      [event, true],
      [event, true],
    ]);
  });
  it('does nothing when no work is available', async () => {
    const f = fixture();
    f.source.claim.mockResolvedValue(null);
    expect(await f.worker.advance()).toBe(false);
    expect(f.store.receive).not.toHaveBeenCalled();
    expect(f.source.resolve).not.toHaveBeenCalled();
  });
});

describe('canonical account inbox', () => {
  it('authorizes the current account, refreshes source metadata and uses the latest read receipt', async () => {
    const f = fixture();
    f.store.current.mockResolvedValue({
      ...page,
      entries: [{ event, readAt: 150 }],
    });
    expect(await f.service.list({}, ctx)).toEqual(
      ok({
        enabled: true,
        items: [{ ...target, at: 100, readAt: 150 }],
        next: null,
      })
    );
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.notifications.read',
        resource: { type: 'user', id: 'Owner' },
      })
    );
    expect(f.source.resolve).toHaveBeenCalledWith('Owner', [event.id]);
    expect(f.store.current.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.source.resolve.mock.invocationCallOrder[0]
    );
  });
  it.each([false, null, 'true'])(
    'denies non-true authorization %j before storage or source access',
    async (decision) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(decision));
      expect(await f.service.list({}, ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(await f.service.markRead({ id: event.id }, ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(f.store.list).not.toHaveBeenCalled();
      expect(f.store.markRead).not.toHaveBeenCalled();
      expect(f.source.resolve).not.toHaveBeenCalled();
    }
  );
  it('rejects client-controlled ownership and malformed continuations', async () => {
    const f = fixture();
    for (const query of [{ recipientId: 'Other' }, { cursor: 'invalid' }])
      expect(await f.service.list(query, ctx)).toEqual(
        err(expect.any(CanonicalIdentityInputError))
      );
    expect(
      await f.service.markRead({ id: event.id, identityId: 'Other' }, ctx)
    ).toEqual(err(expect.any(CanonicalIdentityInputError)));
    expect(f.store.list).not.toHaveBeenCalled();
    expect(f.store.markRead).not.toHaveBeenCalled();
  });
  it('does not expose deliveries after opt-out or lifecycle denial during remote IO', async () => {
    const f = fixture();
    f.store.current.mockResolvedValueOnce({
      ...page,
      enabled: false,
      entries: [],
    });
    expect(await f.service.list({}, ctx)).toEqual(
      ok({ enabled: false, items: [], next: null })
    );
    f.store.current.mockRejectedValueOnce(
      new CanonicalIdentityAccessDenied('Account erased')
    );
    expect(await f.service.list({}, ctx)).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
  });
  it('fails on preference changes and source outages; hides removed source records', async () => {
    const f = fixture();
    f.store.current.mockResolvedValueOnce({ ...page, revision: 4 });
    expect(await f.service.list({}, ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
    f.source.resolve.mockRejectedValueOnce(new Error('Source unavailable'));
    expect(await f.service.list({}, ctx)).toEqual(err(expect.any(Error)));
    f.source.resolve.mockResolvedValueOnce([]);
    expect(await f.service.list({}, ctx)).toEqual(
      ok({ enabled: true, items: [], next: null })
    );
  });
  it('advances bounded pages even when every scanned source is now hidden', async () => {
    const f = fixture();
    const entries = Array.from({ length: 11 }, (_, n) => ({
      event: { ...event, id: id(n + 10), at: 100 - n },
      readAt: null,
    }));
    f.store.list.mockResolvedValue({ ...page, entries });
    f.source.resolve.mockResolvedValue([]);
    expect(await f.service.list({}, ctx)).toEqual(
      ok({ enabled: true, items: [], next: `91.${id(19)}` })
    );
    expect(f.source.resolve.mock.calls[0][1]).toHaveLength(10);
  });
  it('marks only a self-scoped notification after authorization', async () => {
    const f = fixture();
    expect(await f.service.markRead({ id: event.id }, ctx)).toEqual(
      ok({ id: event.id, readAt: 200 })
    );
    expect(f.store.markRead).toHaveBeenCalledWith('Owner', event.id);
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ actionName: 'identity.notifications.update' })
    );
  });
});
