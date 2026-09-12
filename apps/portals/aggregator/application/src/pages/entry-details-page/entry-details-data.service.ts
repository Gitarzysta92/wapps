import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { APPLICATIONS, ARTICLES, ARTICLES_DATA, SUITES_DATA, DISCOVERY_SEARCH_PREVIEW_DATA, DISCOVERY_SEARCH_RESULTS_DATA } from '@portals/shared/data';
import { ARTICLE_CONTENT, ArticleSection } from './article-content';

export const detailSlug = (value: string): string => value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export interface ArticleDetail {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  category: string;
  cover?: { url: string; alt: string };
  publishedDate?: Date;
  updatedDate?: Date;
  sections: ArticleSection[];
}

export interface SuiteApp {
  name: string;
  description: string;
  logo: string;
  slug?: string;
}

export interface SuiteDetail {
  slug: string;
  title: string;
  description: string;
  category: string;
  author?: string;
  apps: SuiteApp[];
  local?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EntryDetailsDataService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'wapps.suite-drafts.v1';
  readonly applications = APPLICATIONS;
  readonly articles: ArticleDetail[] = [
    ...ARTICLES.map(article => ({
      ...article,
      excerpt: article.excerpt.split(' Lorem ipsum')[0],
      cover: article.coverImageUrl,
      sections: ARTICLE_CONTENT[article.slug] ?? [],
    })),
    ...ARTICLES_DATA.map(article => ({
      ...article,
      slug: detailSlug(article.title),
      sections: ARTICLE_CONTENT[detailSlug(article.title)] ?? [],
    })),
  ];
  readonly suites: SuiteDetail[] = [
    ...SUITES_DATA.map(suite => ({
      ...suite,
      slug: detailSlug(suite.title),
      apps: suite.apps.map(app => ({ ...app, slug: APPLICATIONS.find(record => record.name === app.name)?.slug })),
    })),
    ...[DISCOVERY_SEARCH_PREVIEW_DATA, DISCOVERY_SEARCH_RESULTS_DATA]
      .flatMap(data => data.groups.flatMap(group => group.entries))
      .flatMap(entry => 'applications' in entry ? [{
        slug: entry.slug,
        title: entry.name,
        description: '',
        category: 'Collection',
        author: entry.authorName,
        apps: entry.applications.map(app => ({
          name: app.name,
          slug: app.slug,
          logo: app.avatarUrl,
          description: APPLICATIONS.find(record => record.slug === app.slug)?.description ?? '',
        })),
      }] : []),
  ];

  listMySuites(): SuiteDetail[] {
    return this.readDrafts();
  }

  listSuites(): SuiteDetail[] {
    return [...new Map([...this.suites, ...this.readDrafts()].map(suite => [suite.slug, suite])).values()];
  }

  article(slug: string): ArticleDetail | undefined {
    return this.articles.find(article => article.slug === slug || detailSlug(article.title) === slug);
  }

  suite(slug: string): SuiteDetail | undefined {
    return this.suites.find(suite => suite.slug === slug) ?? this.readDrafts().find(suite => suite.slug === slug);
  }

  createSuite(title: string, description: string, appSlugs: string[]): SuiteDetail {
    const apps = APPLICATIONS.filter(app => appSlugs.includes(app.slug));
    if (!title.trim() || title.trim().length > 100 || description.trim().length > 1000 || !apps.length) {
      throw new Error('Add a title and select at least one application.');
    }
    const drafts = this.readDrafts();
    const base = detailSlug(title.trim()) || 'suite';
    let slug = base;
    let suffix = 2;
    while (slug === 'create' || this.suites.some(suite => suite.slug === slug) || drafts.some(suite => suite.slug === slug)) {
      slug = `${base}-${suffix++}`;
    }
    const suite: SuiteDetail = {
      slug, title: title.trim(), description: description.trim(), category: 'Personal collection', local: true,
      apps: apps.map(({ name, description, logo, slug }) => ({ name, description, logo, slug })),
    };
    const storage = this.document.defaultView?.localStorage;
    if (!storage) throw new Error('Local storage is unavailable.');
    storage.setItem(this.storageKey, JSON.stringify([...drafts, suite]));
    return suite;
  }

  private readDrafts(): SuiteDetail[] {
    try {
      const value: unknown = JSON.parse(this.document.defaultView?.localStorage.getItem(this.storageKey) ?? '[]');
      if (!Array.isArray(value)) return [];
      return value.filter((suite): suite is SuiteDetail =>
        suite !== null && typeof suite === 'object' && suite.local === true &&
        typeof suite.slug === 'string' && typeof suite.title === 'string' &&
        typeof suite.description === 'string' && typeof suite.category === 'string' &&
        Array.isArray(suite.apps) && suite.apps.every((app: SuiteApp) => app &&
          typeof app.name === 'string' && typeof app.description === 'string' &&
          typeof app.logo === 'string' && typeof app.slug === 'string' &&
          APPLICATIONS.some(record => record.slug === app.slug)));
    } catch {
      return [];
    }
  }
}
