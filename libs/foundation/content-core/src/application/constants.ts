/** Lifecycle state of content. */
export type ContentState = 'draft' | 'published' | 'archived';

export const CONTENT_STATES: readonly ContentState[] = [
  'draft',
  'published',
  'archived',
] as const;

/** Who can see the content. */
export type ContentVisibility = 'public' | 'unlisted' | 'private';

export const CONTENT_VISIBILITIES: readonly ContentVisibility[] = [
  'public',
  'unlisted',
  'private',
] as const;

/** Intrinsic capability flags (immutable at creation). The core does not interpret these. */
export type IntrinsicCapability = 'canHaveDiscussion' | 'versionable';

export const INTRINSIC_CAPABILITIES: readonly IntrinsicCapability[] = [
  'canHaveDiscussion',
  'versionable',
] as const;

/** Projection type names. Derived representations live in separate stores. */
export type ProjectionType =
  | 'preview'
  | 'rendered-html'
  | 'summary'
  | 'search-text'
  | 'embedding-input';

export const PROJECTION_TYPES: readonly ProjectionType[] = [
  'preview',
  'rendered-html',
  'summary',
  'search-text',
  'embedding-input',
] as const;
