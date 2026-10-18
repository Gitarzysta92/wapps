import { PublicCommunityActivityReader } from './public-community-activity-reader';
import type { CommunityActivityCandidate } from '../application/profile-activity';

const candidate: CommunityActivityCandidate = {
  kind: 'reply',
  id: 'reply',
  rootId: 'root',
  at: 100,
  revision: 3,
  target: { kind: 'application', id: 'app' },
};
const root = { id: 'root', content: { text: 'Root' } };
const reply = { id: 'reply', content: { text: 'Reply' } };
function fixture() {
  const read = jest
    .fn()
    .mockImplementation(async (_target, _id, _actor, rootOnly) => ({
      revision: 3,
      title: 'Public thread',
      comments: rootOnly ? [root] : [root, reply],
    }));
  const applications = { read },
    articles = { read: jest.fn(read) };
  const reviews = {
    read: jest
      .fn()
      .mockResolvedValue({ revision: 7, hidden: false, withdrawn: false }),
  };
  return {
    applications,
    articles,
    reviews,
    reader: new PublicCommunityActivityReader(applications, articles, reviews),
  };
}

describe('public contribution activity reader', () => {
  it.each(['application', 'article'] as const)(
    'loads the full public %s thread for a reply',
    async (kind) => {
      const f = fixture();
      const selected = {
        ...candidate,
        kind: kind === 'article' ? ('comment' as const) : ('reply' as const),
        target: { kind, id: 'parent' },
      };
      expect(await f.reader.read(selected)).toEqual({
        revision: 3,
        title: 'Public thread',
        live: true,
      });
      expect(
        (kind === 'article' ? f.articles : f.applications).read
      ).toHaveBeenCalledWith('parent', 'root', null, false);
    }
  );
  it('can use the root-only read for a root contribution', async () => {
    const f = fixture();
    expect(
      (await f.reader.read({ ...candidate, kind: 'discussion', id: 'root' }))
        .live
    ).toBe(true);
    expect(f.applications.read).toHaveBeenCalledWith('app', 'root', null, true);
  });
  it.each(
    [[], [root], [root, { ...reply, content: null }]].map((comments) => ({
      comments,
    }))
  )('omits a missing or redacted reply in %j', async ({ comments }) => {
    const f = fixture();
    f.applications.read.mockResolvedValue({ revision: 4, comments });
    expect(await f.reader.read(candidate)).toEqual({
      revision: 4,
      title: null,
      live: false,
    });
  });
  it.each([
    { hidden: false, withdrawn: false, live: true },
    { hidden: true, withdrawn: false, live: false },
    { hidden: false, withdrawn: true, live: false },
  ])(
    'uses current review visibility %j',
    async ({ hidden, withdrawn, live }) => {
      const f = fixture();
      f.reviews.read.mockResolvedValue({ revision: 8, hidden, withdrawn });
      expect(await f.reader.read({ ...candidate, kind: 'review' })).toEqual({
        revision: 8,
        title: null,
        live,
      });
      expect(f.reviews.read).toHaveBeenCalledWith('app', 'reply', null);
      expect(f.applications.read).not.toHaveBeenCalled();
    }
  );
  it('preserves unavailable current generations', async () => {
    const f = fixture();
    f.applications.read.mockRejectedValue(new Error('Projection pending'));
    await expect(f.reader.read(candidate)).rejects.toThrow(
      'Projection pending'
    );
  });
});
