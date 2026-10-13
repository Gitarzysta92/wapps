import type { ClassifiedContent } from '@domains/publication/classification';
import type { EventEnvelope } from '@sdk/kernel/aspects/events';

export const EDITORIAL_PROJECTION_QUEUE = 'editorial-projection-v1';
export const EDITORIAL_PROJECTION_FAILED_QUEUE =
  'editorial-projection-v1.failed';

export const EDITORIAL_PROJECTION_SCHEMA = 1;
export const EDITORIAL_MAX_PROJECTION_BYTES = 128 * 1024;
export type EditorialProjectionKind =
  | 'app'
  | 'category'
  | 'tag'
  | 'suite'
  | 'article'
  | 'release';

export interface EditorialArticleContent extends ClassifiedContent {
  title: string;
  slug: string;
  excerpt: string;
  byline: string;
  category: string;
  tags: string[];
  sections: { heading: string; paragraphs: string[] }[];
  cover?: { imageId: string; alt: string };
  submittedRevision: number;
  publishedAt: number;
  updatedAt: number;
}

export interface EditorialReleaseContent {
  applicationId: string;
  version: string;
  channel: 'stable' | 'prerelease';
  type: 'major' | 'minor' | 'patch';
  releasedOn: string;
  title: string;
  description: string;
  changes: {
    type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'security';
    description: string;
  }[];
  publishedAt: number;
}

export interface EditorialSuiteContent extends ClassifiedContent {
  title: string;
  description: string;
  applicationIds: string[];
  submittedRevision: number;
  publishedAt: number;
}

export interface EditorialTaxonomyContent {
  name: string;
  slug: string;
  /** Exact SQL calendar values; no timezone is inferred for existing content. */
  createdAtSql: string;
  updatedAtSql: string;
}

export interface EditorialCategoryContent extends EditorialTaxonomyContent {
  parentId: string | null;
}

export interface EditorialAppContent
  extends EditorialTaxonomyContent,
    ClassifiedContent {
  description: string | null;
  website: string | null;
  isPwa: boolean;
  rating: number | null;
  estimatedNumberOfUsers: number | null;
  isSuspended: boolean;
  logoUrl: string | null;
  bannerUrl: string | null;
  categoryId: string | null;
  tagIds: string[];
  platformIds: string[];
  deviceIds: string[];
  monetizationModelIds: string[];
}

export type EditorialProjectionContent =
  | EditorialArticleContent
  | EditorialReleaseContent
  | EditorialSuiteContent
  | EditorialAppContent
  | EditorialCategoryContent
  | EditorialTaxonomyContent;

/** Complete per-resource snapshot. Related labels are governed by their own revisions. */
export interface EditorialSnapshot {
  kind: EditorialProjectionKind;
  resourceId: string;
  tenantId: string;
  revision: number;
  deletedAt: number | null;
  content: EditorialProjectionContent | null;
}

export interface EditorialProjection extends EditorialSnapshot {
  _id: string;
  schemaVersion: typeof EDITORIAL_PROJECTION_SCHEMA;
  fingerprint: string;
}

/** A wake-up request; the worker must reread current authoritative SQL state. */
export type EditorialProjectionRequestedEvent = EventEnvelope<
  'editorial.materialization.requested',
  {
    kind: EditorialProjectionKind;
    resourceId: string;
    tenantId: string;
    revision: number;
  }
>;
