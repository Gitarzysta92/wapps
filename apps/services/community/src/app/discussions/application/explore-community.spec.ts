import { ExploreCommunity } from './explore-community';
import {
  EXPLORE_READER,
  EXPLORE_READER_ROLE,
  EXPLORE_READER_SCOPE,
} from '@domains/feed';
import { ok, err } from '@sdk/kernel/standard';
const id = '10000000-0000-4000-8000-000000000001';
const actor = {
  identityId: EXPLORE_READER,
  tenantId: EXPLORE_READER_SCOPE,
  roles: [EXPLORE_READER_ROLE],
};
function setup() {
  const candidate = {
    kind: 'discussion' as const,
    id,
    at: 1000,
    revision: 3,
    applicationId: id,
  };
  const item = {
    kind: 'discussion' as const,
    id,
    at: 1000,
    title: 'Test',
    target: {
      kind: 'discussion',
      id,
      applicationId: id,
      applicationSlug: 'test',
    },
    categories: [],
    tags: [],
    engagement: null,
  };
  const index = { read: jest.fn().mockResolvedValue([candidate]) },
    reader = {
      confirm: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue({ item, revision: 3 }),
    },
    policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  return {
    index,
    reader,
    policy,
    candidate,
    item,
    service: new ExploreCommunity(index, reader, policy),
  };
}
describe('discussion Explore source', () => {
  it('rejects a selected candidate outside the requested application', async () => {
    const h = setup();
    await expect(
      h.service.read(
        { after: null, applicationId: '20000000-0000-4000-8000-000000000001' },
        actor
      )
    ).rejects.toThrow();
    expect(h.reader.read).not.toHaveBeenCalled();
  });
  it('restricts kind selections before reading and reconfirms the same selection', async () => {
    const h = setup();
    await expect(
      h.service.read({ after: null, kind: 'article' }, actor)
    ).rejects.toThrow();
    expect(h.index.read).not.toHaveBeenCalled();
    await h.service.read({ after: null, kind: 'discussion' }, actor);
    expect(h.index.read).toHaveBeenNthCalledWith(
      1,
      null,
      'discussion',
      undefined
    );
    expect(h.index.read).toHaveBeenNthCalledWith(
      2,
      null,
      'discussion',
      undefined
    );
    await expect(
      h.service.read({ after: null, kind: 'review' }, actor)
    ).rejects.toThrow();
  });
  it('checks the exact service identity before any storage read', async () => {
    const h = setup();
    await expect(
      h.service.read({ after: null }, { ...actor, identityId: 'Member' })
    ).rejects.toThrow();
    expect(h.policy.evaluate).not.toHaveBeenCalled();
    expect(h.index.read).not.toHaveBeenCalled();
  });
  it.each([ok(false), err(new Error('offline'))])(
    'denies a false or unavailable authorization result',
    async (decision) => {
      const h = setup();
      h.policy.evaluate.mockResolvedValue(decision);
      await expect(h.service.read({ after: null }, actor)).rejects.toThrow();
      expect(h.index.read).not.toHaveBeenCalled();
    }
  );
  it('returns current public content with an independently rechecked authority', async () => {
    const h = setup();
    expect(await h.service.read({ after: null }, actor)).toEqual({
      items: [h.item],
      through: null,
    });
    expect(h.index.read).toHaveBeenCalledTimes(2);
  });
  it('rejects projection lag and authority changes during loading', async () => {
    const h = setup();
    h.reader.read.mockResolvedValue({ item: h.item, revision: 2 });
    await expect(h.service.read({ after: null }, actor)).rejects.toThrow();
    h.reader.read.mockResolvedValue({ item: h.item, revision: 3 });
    h.index.read.mockResolvedValueOnce([h.candidate]).mockResolvedValueOnce([]);
    await expect(h.service.read({ after: null }, actor)).rejects.toThrow();
  });
  it('rejects oversized, nonadvancing and duplicate source scans', async () => {
    const h = setup();
    h.index.read.mockResolvedValue(Array(12).fill(h.candidate));
    await expect(h.service.read({ after: null }, actor)).rejects.toThrow();
    h.index.read.mockResolvedValue([h.candidate]);
    await expect(
      h.service.read({ after: { at: 1000, key: 'discussion:' + id } }, actor)
    ).rejects.toThrow();
    h.index.read.mockResolvedValue([h.candidate, h.candidate]);
    await expect(h.service.read({ after: null }, actor)).rejects.toThrow();
  });
  it('rejects owner and tenant injection', async () => {
    const h = setup();
    await expect(
      h.service.read({ after: null, owner: 'Member' }, actor)
    ).rejects.toThrow();
    expect(h.index.read).not.toHaveBeenCalled();
  });
});
