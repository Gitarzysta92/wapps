import { TimelineService } from './timeline.service';
import { EncryptedExploreCursors } from './explore-cursors';
import { TimelineMissingError, type ExploreItem } from '@domains/feed';

const id = '10000000-0000-4000-8000-000000000001',
  otherId = '10000000-0000-4000-8000-000000000002';
const secret = 'timeline-test-distinct-service-secret-2026';
const cursors = (applicationId: string) =>
  new EncryptedExploreCursors(
    secret,
    () => 1000,
    '\0application-timeline:' + applicationId
  );
function setup() {
  const app = {
    id,
    slug: 'example',
    name: 'Application',
    revision: 1,
    categories: [{ id: 'category-id', slug: 'category' }],
    tags: [],
  };
  const item: ExploreItem = {
    kind: 'application',
    id,
    title: app.name,
    at: 1000,
    target: { kind: 'application', id, slug: app.slug },
    categories: [],
    tags: [],
    engagement: null,
  };
  const applications = { find: jest.fn().mockResolvedValue(app) },
    publications = {
      read: jest.fn().mockResolvedValue({ items: [item], through: null }),
    },
    community = {
      read: jest.fn().mockResolvedValue({ items: [], through: null }),
    };
  return {
    app,
    item,
    applications,
    publications,
    community,
    service: new TimelineService(
      applications,
      publications,
      community,
      cursors
    ),
  };
}
describe('Current application timeline', () => {
  it('binds both bounded source reads to canonical application identity and rechecks the parent', async () => {
    const h = setup();
    const page = await h.service.read('example', {});
    expect(page.application).toEqual({
      id,
      slug: 'example',
      name: 'Application',
    });
    expect(page.items[0].categories).toEqual(['category-id', 'category']);
    expect(h.publications.read).toHaveBeenCalledWith(null, undefined, id);
    expect(h.community.read).toHaveBeenCalledWith(null, undefined, id);
    expect(h.applications.find).toHaveBeenCalledTimes(2);
  });
  it('rejects cross-application and Explore cursors before calling activity sources', async () => {
    const h = setup(),
      position = { at: 1000, key: 'application:' + id };
    for (const token of [
      cursors(otherId).seal(position),
      new EncryptedExploreCursors(secret, () => 1000).seal(position),
    ])
      await expect(h.service.read('example', { after: token })).rejects.toThrow(
        'invalid'
      );
    expect(h.publications.read).not.toHaveBeenCalled();
    h.publications.read.mockResolvedValue({ items: [], through: null });
    await h.service.read('example', { after: cursors(id).seal(position) });
    expect(h.publications.read).toHaveBeenCalledWith(position, undefined, id);
  });
  it('rejects missing applications and parent changes across source I/O', async () => {
    const h = setup();
    h.applications.find.mockResolvedValueOnce(null);
    await expect(h.service.read('example', {})).rejects.toBeInstanceOf(
      TimelineMissingError
    );
    expect(h.publications.read).not.toHaveBeenCalled();
    h.applications.find
      .mockResolvedValueOnce(h.app)
      .mockResolvedValueOnce(null);
    await expect(h.service.read('example', {})).rejects.toBeInstanceOf(
      TimelineMissingError
    );
    h.applications.find
      .mockResolvedValueOnce(h.app)
      .mockResolvedValueOnce({ ...h.app, revision: 2 });
    await expect(h.service.read('example', {})).rejects.toThrow(
      'temporarily unavailable'
    );
  });
  it('does not return foreign application activity or a partial page on source failure', async () => {
    const h = setup();
    h.publications.read.mockResolvedValue({
      items: [
        {
          ...h.item,
          id: otherId,
          target: { kind: 'application', id: otherId, slug: 'other' },
        },
      ],
      through: null,
    });
    await expect(h.service.read('example', {})).rejects.toThrow(
      'temporarily unavailable'
    );
    h.community.read.mockRejectedValue(new Error('offline'));
    await expect(h.service.read('example', {})).rejects.toThrow(
      'temporarily unavailable'
    );
  });
  it('rejects tenant, owner and page-size injection before I/O', async () => {
    const h = setup();
    for (const query of [
      { tenant: 'other' },
      { owner: 'member' },
      { pageSize: 1000 },
    ])
      await expect(h.service.read('example', query)).rejects.toThrow(
        'Invalid timeline query'
      );
    expect(h.applications.find).not.toHaveBeenCalled();
  });
});
