import { PortalContentPreferences } from '../preferences/portal-content-preferences';
import { Injectable, ConflictException } from '@nestjs/common';
import {
  FAVORITE_KINDS,
  parseFavoriteContent,
  type ResolvedFavoriteContent,
} from '@domains/customer/favorites';
import { classificationFields } from '@domains/publication/classification';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import { PortalMemberClient } from './portal-member.client';

@Injectable()
export class PortalFavoriteContentService {
  constructor(
    private readonly member: PortalMemberClient,
    private readonly preferences: PortalContentPreferences
  ) {}
  read(actor: TrustedPortalIdentity) {
    return this.preferences.read(
      actor,
      () => this.load(actor),
      (page, permits) => ({
        ...page,
        items: page.items.map((item) =>
          item.status === 'available' && !permits(item)
            ? {
                kind: item.kind,
                id: item.id,
                name: 'Unavailable favorite',
                slug: null,
                status: 'unavailable' as const,
              }
            : item
        ),
      })
    );
  }
  private async load(actor: TrustedPortalIdentity) {
    const signal = AbortSignal.timeout(12_000);
    const saved = await this.member.favorites(actor, signal);
    const ids = (kind: (typeof FAVORITE_KINDS)[number]) =>
      saved.favorites
        .filter((target) => target.kind === kind)
        .map((target) => target.id);
    const [apps, articles, suites, topics] = await Promise.all([
      this.member.apps(ids('applications'), signal),
      this.member.articles(ids('articles'), signal),
      this.member.suites(ids('suites'), signal),
      this.member.discussions(ids('discussions'), signal),
    ]);
    const parents = await this.member.apps(
      [...new Set(topics.map((topic) => topic.applicationId))],
      signal
    );
    const items = FAVORITE_KINDS.flatMap((kind) =>
      ids(kind).map((id): ResolvedFavoriteContent => {
        const app =
          kind === 'applications'
            ? apps.find((item) => item.id === id)
            : undefined;
        const article =
          kind === 'articles'
            ? articles.find((item) => item.id === id)
            : undefined;
        const suite =
          kind === 'suites' ? suites.find((item) => item.id === id) : undefined;
        const topic =
          kind === 'discussions'
            ? topics.find((item) => item.id === id)
            : undefined;
        const parent = topic
          ? parents.find((item) => item.id === topic.applicationId)
          : undefined;
        if (app)
          return {
            kind,
            id,
            name: app.name,
            slug: app.slug,
            status: 'available',
            ...classificationFields(app.classification),
            ...(app.logoUrl ? { image: app.logoUrl } : {}),
          };
        if (article)
          return {
            kind,
            id,
            name: article.title,
            slug: article.slug,
            status: 'available',
            ...classificationFields(article.classification),
          };
        if (suite)
          return {
            kind,
            id,
            name: suite.title,
            slug: id,
            status: 'available',
            ...classificationFields(suite.classification),
          };
        if (topic && parent)
          return {
            kind,
            id,
            name: topic.title,
            slug: id,
            appSlug: parent.slug,
            status: 'available',
            ...classificationFields(parent.classification),
          };
        const label = {
          applications: 'application',
          articles: 'article',
          suites: 'suite',
          discussions: 'discussion',
        }[kind];
        return {
          kind,
          id,
          name: `Unavailable ${label}`,
          slug: null,
          status: 'unavailable',
        };
      })
    );
    const current = await this.member.favorites(actor, signal);
    if (
      current.revision !== saved.revision ||
      JSON.stringify(current.favorites) !== JSON.stringify(saved.favorites)
    )
      throw new ConflictException(
        'Saved favorites changed. Reload before trying again.'
      );
    return parseFavoriteContent(
      { identityId: saved.identityId, revision: saved.revision, items },
      saved.favorites.map(({ kind, id }) => ({ kind, id }))
    );
  }
}
