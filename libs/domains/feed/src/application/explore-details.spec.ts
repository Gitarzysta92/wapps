import { parseExploreItem, type ExploreItem } from './explore';
import { parseActivityDetails, type ActivityDetails } from './explore-details';
import { selectExplorePage, type ExploreSelection } from './explore-selection';
import { selectDigest } from './digest';

const id = '10000000-0000-4000-8000-000000000001';
const appId = '10000000-0000-4000-8000-000000000002';
const details: ActivityDetails[] = [
  {
    kind: 'application',
    revision: 2,
    description: 'Real application',
    logoUrl: null,
    bannerUrl: 'https://example.com/banner.png',
    category: { name: 'Tools', slug: 'tools' },
    tags: [],
    reviews: { total: 0, rating: null },
  },
  {
    kind: 'article',
    byline: 'Reviewed author',
    excerpt: 'Real excerpt',
    category: 'Guide',
    publishedAt: 1000,
    cover: { imageId: appId, alt: 'Reviewed cover' },
    tags: [{ name: 'Offline', slug: 'Offline' }],
  },
  {
    kind: 'suite',
    description: 'Collection',
    applicationCount: 1,
    applications: [
      {
        id: appId,
        slug: 'app',
        name: 'Mature member',
        description: '',
        logoUrl: null,
        classification: 'mature',
      },
    ],
  },
  {
    kind: 'release',
    applicationName: 'App',
    logoUrl: null,
    description: 'Changes',
    releasedOn: '2026-10-13',
    channel: 'stable',
    releaseType: 'patch',
    changeCount: 1,
    changes: [{ type: 'fix', description: 'Real fix' }],
  },
  {
    kind: 'review',
    applicationName: 'App',
    logoUrl: null,
    byline: 'Deleted account',
    rating: 4,
    text: 'Retained review',
    publishedAt: 1000,
  },
  {
    kind: 'discussion',
    applicationName: 'App',
    replyCount: 2,
    posts: [{ id, byline: 'Member', text: 'Public post', publishedAt: 1000 }],
  },
];
function item(detail: ActivityDetails): ExploreItem {
  const kind = detail.kind;
  const target =
    kind === 'suite'
      ? { kind, id }
      : kind === 'article' || kind === 'application'
      ? { kind, id, slug: 'entry' }
      : kind === 'release'
      ? {
          kind,
          id,
          applicationId: appId,
          applicationSlug: 'app',
          version: '1.0.0',
        }
      : { kind, id, applicationId: appId, applicationSlug: 'app' };
  return {
    kind,
    id,
    target,
    at: 1000,
    title: 'Public content',
    categories: [],
    tags: [],
    engagement: null,
    classification: 'general',
    details: detail,
  };
}
const choices: ExploreSelection = {
  showMatureContent: false,
  order: 'recent',
  personalize: false,
  preferredCategories: [],
  excludedCategories: [],
  preferredTags: [],
  favorites: new Set(),
};
describe('rich activity transport', () => {
  it.each(details)('retains the bounded public $kind preview', (detail) => {
    expect(parseExploreItem(item(detail)).details).toEqual(detail);
    expect(() =>
      parseExploreItem({
        ...item(detail),
        details: { ...detail, ownerIdentityId: 'private' },
      })
    ).toThrow();
    expect(() =>
      parseExploreItem({
        ...item(detail),
        details: { ...detail, kind: 'other' },
      })
    ).toThrow();
  });
  it('rejects unsafe media URLs, inconsistent ratings, invalid cover references and unbounded content', () => {
    for (const change of [
      { logoUrl: 'javascript:alert(1)' },
      { bannerUrl: 'https://secret@example.com/image' },
      { reviews: { total: 0, rating: 0 } },
      { reviews: { total: 1, rating: null } },
      { description: 'x'.repeat(1001) },
    ])
      expect(() =>
        parseActivityDetails({ ...details[0], ...change }, 'application')
      ).toThrow();
    expect(() =>
      parseActivityDetails(
        { ...details[1], cover: { url: 'https://example.com/private' } },
        'article'
      )
    ).toThrow();
    expect(() =>
      parseExploreItem({
        ...item(details[5]),
        details: {
          ...details[5],
          posts: [
            {
              id: appId,
              byline: 'Member',
              text: 'Other root',
              publishedAt: 1000,
            },
          ],
        },
      })
    ).toThrow();
  });
  it('masks mature and unclassified suite members without mutating source data or losing the collection count', () => {
    const source = item(details[2]);
    const selected = selectExplorePage([source], choices)[0].details;
    expect(selected).toEqual({
      kind: 'suite',
      description: 'Collection',
      applicationCount: 1,
      applications: [],
    });
    expect(
      selectExplorePage([source], { ...choices, showMatureContent: true })[0]
    ).toEqual(source);
    const digest = selectDigest(
      {
        latest: { items: [source], more: false },
        discussions: { items: [], more: false },
        articles: { items: [], more: false },
        applications: { items: [], more: false },
      },
      choices
    );
    expect(digest.latest.items[0].details).toEqual(selected);
    if (source.details?.kind !== 'suite') throw new Error('Expected suite');
    delete source.details.applications[0].classification;
    expect(selectExplorePage([source], choices)[0].details).toEqual(selected);
  });
});
