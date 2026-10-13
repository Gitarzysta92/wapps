import { DigestService } from './digest.service';
import { HttpExploreSource } from './explore-source';

function setup() {
  const activity = {
    read: jest.fn().mockResolvedValue({ items: [], after: null }),
  };
  const community = {
    read: jest.fn().mockResolvedValue({ items: [], through: null }),
  };
  const applications = {
    browse: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
  };
  const articles = {
    read: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1 }),
  };
  return {
    activity,
    community,
    applications,
    articles,
    service: new DigestService(activity, community, applications, articles),
  };
}
describe('Digest source composition', () => {
  it('selects each family independently and strips internal hidden boundaries', async () => {
    const h = setup();
    h.community.read.mockResolvedValue({
      items: [],
      through: {
        at: 1000,
        key: 'discussion:10000000-0000-4000-8000-000000000001',
      },
    });
    const result = await h.service.read({});
    expect(result.discussions).toEqual({ items: [], more: true });
    expect(JSON.stringify(result)).not.toContain('10000000');
    expect(h.community.read).toHaveBeenCalledWith(null, 'discussion');
    expect(h.applications.browse).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'newest', page: 1, pageSize: 10 })
    );
  });
  it.each(['activity', 'community', 'articles'] as const)(
    'rejects %s failure without a partial successful digest',
    async (key) => {
      const h = setup();
      h[key].read.mockRejectedValue(new Error('offline'));
      await expect(h.service.read({})).rejects.toThrow(
        'Digest could not be loaded'
      );
    }
  );
  it('rejects application failure and invalid upstream pagination', async () => {
    const h = setup();
    h.applications.browse.mockRejectedValueOnce(new Error('offline'));
    await expect(h.service.read({})).rejects.toThrow();
    h.articles.read.mockResolvedValue({ items: [], page: 2, total: 0 });
    await expect(h.service.read({})).rejects.toThrow();
  });
  it('rejects caller-supplied scope and unbounded options before I/O', async () => {
    const h = setup();
    for (const input of [
      { owner: 'member' },
      { tenant: 'other' },
      { limit: 10000 },
    ])
      await expect(h.service.read(input)).rejects.toThrow();
    expect(h.activity.read).not.toHaveBeenCalled();
  });
  it('sends a bounded kind selection and rejects a mismatched hidden scan kind', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [],
            through: {
              at: 1000,
              key: 'review:10000000-0000-4000-8000-000000000001',
            },
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      );
    const source = new HttpExploreSource(
      'http://localhost:1234',
      'digest-test-distinct-service-secret-2026',
      ['discussion', 'review'],
      request
    );
    await expect(source.read(null, 'discussion')).rejects.toThrow(
      'Unexpected Explore source kind'
    );
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      after: null,
      kind: 'discussion',
    });
    await expect(source.read(null, 'application')).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
