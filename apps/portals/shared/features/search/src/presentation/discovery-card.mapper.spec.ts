import type { PublicDiscoveryItem } from '@domains/discovery';
import { mapDiscoveryCard, type DiscoveryCardLinkTarget } from './discovery-card.mapper';

const item: PublicDiscoveryItem = {
  id: '10000000-0000-4000-8000-000000000001',
  slug: 'team-tool', title: 'Team tool', summary: 'Published summary',
  revision: 2, at: 1000, classification: 'general',
  categories: [], tags: ['internal-id', 'work'],
  displayTags: [{ slug: 'work', name: 'Work tools' }],
};
const link = (target: DiscoveryCardLinkTarget) => JSON.stringify(target);

describe('accepted Discover card mapping', () => {
  it('retains canonical favorite identity, review identity, byline and publication time', () => {
    const vm = mapDiscoveryCard('application', {
      ...item,
      details: { kind: 'application', logoUrl: 'https://example.test/logo.png', reviews: {
        total: 7, rating: 4.3,
        preview: { id: 'review-id', byline: 'Actual reviewer', rating: 4, text: 'Published review', publishedAt: 1234 },
      } },
    }, link);
    if (vm.kind !== 'application') throw new Error('Wrong card kind');
    expect(vm.id).toBe(item.id);
    expect(vm.slug).toBe(item.slug);
    expect(vm.rating).toBe(4.3);
    expect(vm.reviewsCount).toBe(7);
    expect(vm.topReview).toEqual({ authorName: 'Actual reviewer', authorAvatarUrl: '', rating: 4,
      content: 'Published review', publishedAt: 1234,
      detailsLink: link({ kind: 'review', applicationSlug: 'team-tool', id: 'review-id' }),
    });
    expect(vm.tags).toEqual([{ slug: 'work', name: 'Work tools', link: link({ kind: 'tag', slug: 'work' }) }]);
  });

  it('distinguishes a real zero-review result from an unavailable preview', () => {
    const known = mapDiscoveryCard('application', { ...item,
      details: { kind: 'application', logoUrl: null, reviews: { total: 0, rating: null, preview: null } },
    }, link);
    const unknown = mapDiscoveryCard('application', item, link);
    if (known.kind !== 'application' || unknown.kind !== 'application') throw new Error('Wrong card kind');
    expect(known.reviewsCount).toBe(0);
    expect(known.rating).toBeNull();
    expect(unknown.reviewsCount).toBeNull();
    expect(unknown.rating).toBeNull();
    expect(unknown.topReview).toBeNull();
  });

  it('maps protected article covers without generating public image URLs or badges', () => {
    const cover = { imageId: 'image-id', alt: 'Published cover description' };
    const vm = mapDiscoveryCard('article', { ...item, details: { kind: 'article', byline: 'Published byline', cover } }, link);
    if (vm.kind !== 'article') throw new Error('Wrong card kind');
    expect(vm.cover).toEqual(cover);
    expect(vm.author).toEqual({ name: 'Published byline', avatarUrl: '' });
    expect(vm.articleLink).toBe(link({ kind: 'article', slug: 'team-tool' }));
    expect(vm).not.toHaveProperty('authorBadges');
  });

  it('retains the suite total independently of its bounded, visibility-filtered members', () => {
    const vm = mapDiscoveryCard('suite', { ...item, slug: null, details: {
      kind: 'suite', applicationCount: 12,
      applications: [{ id: 'member-id', slug: 'visible-app', name: 'Visible app', logoUrl: null, classification: 'general' }],
    } }, link);
    if (vm.kind !== 'suite') throw new Error('Wrong card kind');
    expect(vm.suiteLink).toBe(link({ kind: 'suite', id: item.id }));
    expect(vm.slug).toBe(item.id);
    expect(vm.applicationCount).toBe(12);
    expect(vm.applications).toEqual([{ slug: 'visible-app', name: 'Visible app', avatarUrl: '' }]);
    expect(vm).not.toHaveProperty('rating');
    expect(vm).not.toHaveProperty('topReview');
  });

  it('does not turn missing article or suite previews into demo authors or counts', () => {
    const article = mapDiscoveryCard('article', item, link);
    const suite = mapDiscoveryCard('suite', item, link);
    if (article.kind !== 'article' || suite.kind !== 'suite') throw new Error('Wrong card kind');
    expect(article.author).toBeNull();
    expect(article.cover).toBeNull();
    expect(suite.applicationCount).toBeNull();
  });
});
