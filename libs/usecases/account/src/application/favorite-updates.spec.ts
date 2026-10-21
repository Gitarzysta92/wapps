import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import type { FavoriteUpdateState } from '@domains/customer/favorites';
import {
  DeliverFavoriteUpdates,
  FavoriteUpdatesService,
} from './favorite-updates';
import { FavoriteUpdateSourceAccess } from './favorite-update-source';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const target = { kind: 'applications' as const, id: id(1) };
const state: FavoriteUpdateState = {
  target,
  version: 3,
  at: 200,
  content: {
    title: 'Current application',
    classification: 'general',
    destination: { kind: 'applications', slug: 'current' },
  },
};
const lease = { identityId: 'alice', target, generation: id(2), token: id(3) };
const entry = {
  id: id(4),
  target,
  generation: id(2),
  version: 2,
  at: 100,
  readAt: null,
};
const context = { identityId: 'alice', timestamp: 1, subject: { roles: [] } };
function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  const store = {
    claim: jest.fn().mockResolvedValue(lease),
    settle: jest.fn(),
    fail: jest.fn(),
    list: jest
      .fn()
      .mockResolvedValue({ revision: 2, enabled: true, entries: [entry] }),
    current: jest
      .fn()
      .mockResolvedValue({ revision: 2, enabled: true, entries: [entry] }),
    markRead: jest.fn().mockResolvedValue({ id: entry.id, readAt: 300 }),
  };
  const source = { read: jest.fn().mockResolvedValue(state) },
    available = jest.fn().mockReturnValue(true);
  return {
    store,
    source,
    available,
    evaluate,
    service: new FavoriteUpdatesService(authority, store, source, available),
    delivery: new DeliverFavoriteUpdates(store, source),
  };
}
describe('favorite update delivery and private inbox', () => {
  it.each(['mature', undefined])(
    'filters current %s classification before exposing inbox metadata',
    async (classification) => {
      const f = fixture();
      f.source.read.mockResolvedValue({
        ...state,
        content: { ...state.content, classification },
      });
      expect(await f.service.list({}, context)).toEqual(
        ok({ enabled: true, items: [], next: null })
      );
      f.store.current.mockResolvedValue({
        revision: 2,
        enabled: true,
        showMatureContent: true,
        entries: [entry],
      });
      const result = await f.service.list({}, context);
      expect(result.ok && result.value.items.length).toBe(1);
    }
  );
  it('settles the exact leased subscription only after resolving its current source', async () => {
    const f = fixture();
    expect(await f.delivery.advance()).toBe(true);
    expect(f.store.settle).toHaveBeenCalledWith(lease, state);
    expect(f.store.fail).not.toHaveBeenCalled();
    f.store.claim.mockResolvedValue(null);
    expect(await f.delivery.advance()).toBe(false);
  });
  it('retains durable retry for a failed source or commit and rejects a substituted target', async () => {
    for (const failure of ['source', 'scope', 'commit']) {
      const f = fixture();
      if (failure === 'source')
        f.source.read.mockRejectedValue(new Error('offline'));
      if (failure === 'scope')
        f.source.read.mockResolvedValue({
          ...state,
          target: { ...target, id: id(99) },
        });
      if (failure === 'commit')
        f.store.settle.mockRejectedValue(new Error('rollback'));
      await expect(f.delivery.advance()).rejects.toThrow();
      expect(f.store.fail).toHaveBeenCalledWith(lease);
      if (failure !== 'commit') expect(f.store.settle).not.toHaveBeenCalled();
    }
  });
  it('authorizes self before reading private membership and rechecks after remote visibility', async () => {
    const f = fixture();
    expect(await f.service.list({}, context)).toEqual(
      ok({
        enabled: true,
        items: [
          { id: entry.id, target, ...state.content, at: 100, readAt: null },
        ],
        next: null,
      })
    );
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ resource: { type: 'user', id: 'alice' } })
    );
    expect(f.store.current.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.source.read.mock.invocationCallOrder[0]
    );
  });
  it('never treats a policy false result or policy outage as permission', async () => {
    for (const decision of [ok(false), err(new Error('offline'))]) {
      const f = fixture();
      f.evaluate.mockResolvedValue(decision);
      expect((await f.service.list({}, context)).ok).toBe(false);
      expect(f.store.list).not.toHaveBeenCalled();
    }
  });
  it('returns unavailable when delivery is disabled even for an empty inbox', async () => {
    const f = fixture();
    f.available.mockReturnValue(false);
    expect((await f.service.list({}, context)).ok).toBe(false);
    expect(f.store.list).not.toHaveBeenCalled();
  });
  it('honors opt-out before lookup and during remote work without stale content', async () => {
    for (const phase of ['list', 'current'] as const) {
      const f = fixture();
      f.store[phase].mockResolvedValue({
        revision: 2,
        enabled: false,
        entries: [],
      });
      expect(await f.service.list({}, context)).toEqual(
        ok({ enabled: false, items: [], next: null })
      );
      if (phase === 'list') expect(f.source.read).not.toHaveBeenCalled();
    }
  });
  it('hides removed favorites and withdrawn content while preserving bounded page traversal', async () => {
    const f = fixture();
    f.store.list.mockResolvedValue({
      revision: 2,
      enabled: true,
      entries: Array.from({ length: 11 }, (_, n) => ({
        ...entry,
        id: id(n + 10),
      })),
    });
    f.store.current.mockResolvedValue({
      revision: 2,
      enabled: true,
      entries: [],
    });
    expect(await f.service.list({}, context)).toEqual(
      ok({ enabled: true, items: [], next: `100.${id(19)}` })
    );
    expect(f.source.read).toHaveBeenCalledTimes(1);
    f.store.current.mockResolvedValue({
      revision: 3,
      enabled: true,
      entries: [],
    });
    expect((await f.service.list({}, context)).ok).toBe(false);
  });
  it('rejects authority regression and does not forward foreign identity fields', async () => {
    const f = fixture();
    f.source.read.mockResolvedValue({ ...state, version: 1 });
    expect((await f.service.list({}, context)).ok).toBe(false);
    expect(
      (await f.service.markRead({ id: entry.id, identityId: 'bob' }, context))
        .ok
    ).toBe(false);
    expect(f.store.markRead).not.toHaveBeenCalled();
    expect(await f.service.markRead({ id: entry.id }, context)).toEqual(
      ok({ id: entry.id, readAt: 300 })
    );
    expect(f.store.markRead).toHaveBeenCalledWith('alice', entry.id);
  });
});
describe('service-only favorite source boundary', () => {
  const actor = {
    identityId: 'wapps-notification-worker',
    tenantId: 'notifications',
    roles: ['notification:worker'],
  };
  it('requires the exact service identity, scope, role and affirmative policy', async () => {
    const source = { read: jest.fn().mockResolvedValue(state) },
      evaluate = jest.fn().mockResolvedValue(ok(true));
    const access = new FavoriteUpdateSourceAccess(
      source,
      { evaluate },
      'editorial'
    );
    for (const bad of [
      { ...actor, identityId: 'admin' },
      { ...actor, tenantId: 'default' },
      { ...actor, roles: ['admin'] },
    ])
      await expect(access.read(target, bad)).rejects.toThrow();
    expect(source.read).not.toHaveBeenCalled();
    evaluate.mockResolvedValue(ok(false));
    await expect(access.read(target, actor)).rejects.toThrow();
    evaluate.mockResolvedValue(ok(true));
    expect(await access.read(target, actor)).toEqual(state);
    await expect(
      access.read({ ...target, kind: 'discussions' }, actor)
    ).rejects.toThrow();
  });
});
