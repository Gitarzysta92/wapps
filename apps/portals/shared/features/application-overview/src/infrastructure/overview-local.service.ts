import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import {
  APPLICATIONS,
  CATEGORIES,
  PLATFORMS,
  TAGS,
} from '@portals/shared/data';
import {
  CATALOG_ENTRIES,
  normalizeCatalogFacet,
} from '@portals/shared/features/listing';
import { IApplicationOverviewProvider } from '../application/overview-providers.port';
import { OverviewDto } from '../application/overview.dto';

function date(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const result = new Date(value);
  return Number.isFinite(result.valueOf()) ? result.toISOString() : null;
}

export function demoApplicationOverview(
  app: (typeof APPLICATIONS)[number]
): OverviewDto {
  const category = CATEGORIES.find(
    (category) => String(category.id) === String(app.categoryId)
  );
  return {
    id: String(app.id),
    revision: null,
    slug: app.slug,
    name: app.name,
    description: app.description,
    website: null,
    logo: app.logo ?? null,
    banner: null,
    isPwa: app.isPwa ?? false,
    listingDate: date(app.listingDate),
    updateDate: date(app.updateDate),
    platforms: PLATFORMS.filter((platform) =>
      app.platformIds.includes(platform.id)
    ).map((platform) => ({
      name: platform.name,
      slug: normalizeCatalogFacet(platform.name),
    })),
    monetizations: app.monetizations.map((plan) => ({
      name: plan.name,
      slug: normalizeCatalogFacet(plan.name),
    })),
    categories: category ? [{ name: category.name, slug: category.slug }] : [],
    tags: TAGS.filter((tag) => app.tagIds.includes(String(tag.id))).map(
      (tag) => ({ name: tag.name, slug: normalizeCatalogFacet(tag.slug) })
    ),
    estimatedUsers:
      Number.isFinite(app.number) && app.number >= 0 ? app.number : null,
    reviews: {
      total: app.reviewNumber,
      rating: app.reviewNumber > 0 ? app.rating : null,
    },
    includedSuites: CATALOG_ENTRIES.filter(
      (entry) =>
        entry.kind === 'suites' &&
        entry.applications?.some((member) => member.slug === app.slug)
    ).map((suite) => ({
      slug: suite.slug,
      name: suite.name,
      image: suite.image,
      author: suite.author,
      members: [
        ...new Map(
          (suite.applications ?? []).map((member) => [
            member.slug || member.name,
            member,
          ])
        ).values(),
      ],
    })),
  };
}

export class ApplicationNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Application not found');
  }
}

@Injectable()
export class OverviewLocalService implements IApplicationOverviewProvider {
  getOverview(slug: string) {
    const app = APPLICATIONS.find((item) => item.slug === slug);
    return of(
      app
        ? { ok: true as const, value: demoApplicationOverview(app) }
        : { ok: false as const, error: new ApplicationNotFoundError() }
    );
  }
}
