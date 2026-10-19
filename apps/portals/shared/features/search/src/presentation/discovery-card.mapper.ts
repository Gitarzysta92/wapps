import type { DiscoveryKind, PublicDiscoveryItem } from '@domains/discovery';

export type DiscoveryCardLinkTarget =
  | { kind: 'application' | 'article' | 'tag'; slug: string }
  | { kind: 'suite'; id: string }
  | { kind: 'application-reviews'; applicationSlug: string }
  | { kind: 'review'; applicationSlug: string; id: string };

/** Keep canonical identities and published previews separate from demo card data. */
export function mapDiscoveryCard(
  kind: DiscoveryKind,
  item: PublicDiscoveryItem,
  link: (target: DiscoveryCardLinkTarget) => string
) {
  const common = {
    id: item.id,
    slug: item.slug ?? item.id,
    title: item.title,
    summary: item.summary,
    detailsAvailable: item.details?.kind === kind,
    tags: (item.displayTags ?? []).map(tag => ({
      ...tag,
      link: link({ kind: 'tag', slug: tag.slug }),
    })),
  };
  const details = item.details;
  switch (kind) {
    case 'application': {
      const preview = details?.kind === kind ? details : null;
      const review = preview?.reviews.preview;
      return {
        ...common,
        kind,
        applicationLink: link({ kind, slug: common.slug }),
        avatarUrl: preview?.logoUrl ?? '',
        rating: preview?.reviews.rating ?? null,
        reviewsCount: preview?.reviews.total ?? null,
        reviewsLink: link({ kind: 'application-reviews', applicationSlug: common.slug }),
        topReview: review ? {
          authorName: review.byline,
          authorAvatarUrl: '',
          rating: review.rating,
          content: review.text,
          publishedAt: review.publishedAt,
          detailsLink: link({ kind: 'review', applicationSlug: common.slug, id: review.id }),
        } : null,
      };
    }
    case 'article': {
      const preview = details?.kind === kind ? details : null;
      return {
        ...common,
        kind,
        articleLink: link({ kind, slug: common.slug }),
        cover: preview?.cover ?? null,
        author: preview ? { name: preview.byline, avatarUrl: '' } : null,
      };
    }
    case 'suite': {
      const preview = details?.kind === kind ? details : null;
      return {
        ...common,
        kind,
        suiteLink: link({ kind, id: item.id }),
        applicationCount: preview?.applicationCount ?? null,
        applications: (preview?.applications ?? []).map(app => ({
          slug: app.slug,
          name: app.name,
          avatarUrl: app.logoUrl ?? '',
        })),
      };
    }
  }
}

export type DiscoveryCardVM = ReturnType<typeof mapDiscoveryCard>;
