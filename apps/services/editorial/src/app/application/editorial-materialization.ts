import { classificationFields } from '@domains/publication/classification';
import { createHash } from 'node:crypto';
import { parseSuiteFields, suiteRevision } from '@domains/publication/suite';
import {
  ARTICLE_FIELD_KEYS,
  articleFieldsFrom,
  articleRevision,
  articleTimestamp,
} from '@domains/publication/article';
import {
  assertReleaseSubmissionDate,
  parseReleaseFields,
  releaseId,
  releaseTimestamp,
} from '@domains/catalog/versioning';
import {
  EDITORIAL_MAX_PROJECTION_BYTES,
  EDITORIAL_PROJECTION_SCHEMA,
  EditorialAppContent,
  EditorialProjection,
  EditorialProjectionContent,
  EditorialProjectionKind,
  EditorialSnapshot,
} from '@apps/shared';

export class InvalidEditorialSnapshot extends Error {}

export interface EditorialSnapshotReader {
  read(
    kind: EditorialProjectionKind,
    resourceId: string
  ): Promise<EditorialSnapshot>;
}

export type EditorialPublicationOutcome =
  | 'published'
  | 'unchanged'
  | 'superseded';

export interface EditorialProjectionStore {
  /** Atomically publish a complete document; reject conflicting data at one revision. */
  publish(
    projection: EditorialProjection
  ): Promise<EditorialPublicationOutcome>;
  find(
    kind: EditorialProjectionKind,
    resourceId: string
  ): Promise<unknown | null>;
}

export function assertEditorialSnapshot(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new InvalidEditorialSnapshot(message);
}

export function editorialProjectionId(
  kind: EditorialProjectionKind,
  resourceId: string
): string {
  return `${kind}:${resourceId}`;
}

export function isEditorialResourceId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  );
}

export function isEditorialScope(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    ![...value].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  );
}

function object(value: unknown): Record<string, unknown> {
  assertEditorialSnapshot(
    value && typeof value === 'object' && !Array.isArray(value),
    'Invalid snapshot object'
  );
  return Object.fromEntries(Object.entries(value));
}

function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  assertEditorialSnapshot(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
    'Unexpected snapshot fields'
  );
}

function text(value: unknown, max: number, nullable = false): string | null {
  if (nullable && value === null) return null;
  assertEditorialSnapshot(
    typeof value === 'string' && Buffer.byteLength(value) <= max,
    'Invalid snapshot text'
  );
  return value;
}

function ids(value: unknown): string[] {
  assertEditorialSnapshot(
    Array.isArray(value) &&
      value.length <= 50 &&
      value.every(isEditorialResourceId),
    'Invalid snapshot references'
  );
  assertEditorialSnapshot(
    new Set(value).size === value.length,
    'Duplicate snapshot references'
  );
  return [...value].sort();
}

function reference(value: unknown): string | null {
  assertEditorialSnapshot(
    value === null || isEditorialResourceId(value),
    'Invalid snapshot reference'
  );
  return value;
}

function calendar(value: unknown): string {
  assertEditorialSnapshot(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/.test(value),
    'Invalid SQL calendar timestamp'
  );
  const time = new Date(value.replace(' ', 'T').slice(0, 23) + 'Z');
  assertEditorialSnapshot(
    Number.isFinite(time.getTime()) &&
      time.toISOString().slice(0, 23) === value.replace(' ', 'T').slice(0, 23),
    'Invalid SQL calendar timestamp'
  );
  return value;
}

export function parseEditorialContent(
  kind: EditorialProjectionKind,
  input: unknown,
  allowScrubbedApplication = false
): EditorialProjectionContent {
  const value = object(input);
  if (kind === 'article') {
    exactKeys(value, [
      ...ARTICLE_FIELD_KEYS.filter(
        (key) =>
          !['cover', 'classification'].includes(key) ||
          Object.prototype.hasOwnProperty.call(value, key)
      ),
      'submittedRevision',
      'publishedAt',
      'updatedAt',
    ]);
    const publishedAt = articleTimestamp(value.publishedAt),
      updatedAt = articleTimestamp(value.updatedAt);
    assertEditorialSnapshot(
      updatedAt >= publishedAt,
      'Invalid article publication timestamps'
    );
    return {
      ...articleFieldsFrom(value),
      submittedRevision: articleRevision(value.submittedRevision),
      publishedAt,
      updatedAt,
    };
  }
  if (kind === 'release') {
    exactKeys(value, [
      'applicationId',
      'version',
      'channel',
      'type',
      'releasedOn',
      'title',
      'description',
      'changes',
      'publishedAt',
    ]);
    const { applicationId, publishedAt, ...fields } = value;
    const parsed = parseReleaseFields(fields);
    assertReleaseSubmissionDate(parsed, releaseTimestamp(publishedAt));
    return {
      ...parsed,
      applicationId: releaseId(applicationId),
      publishedAt: releaseTimestamp(publishedAt),
    };
  }
  if (kind === 'suite') {
    exactKeys(value, [
      'title',
      'description',
      'applicationIds',
      ...(Object.prototype.hasOwnProperty.call(value, 'classification')
        ? ['classification']
        : []),
      'submittedRevision',
      'publishedAt',
    ]);
    assertEditorialSnapshot(
      typeof value.publishedAt === 'number' &&
        Number.isSafeInteger(value.publishedAt) &&
        value.publishedAt >= 0,
      'Invalid publication timestamp'
    );
    return {
      ...parseSuiteFields({
        title: value.title,
        description: value.description,
        applicationIds: value.applicationIds,
        classification: value.classification,
      }),
      submittedRevision: suiteRevision(value.submittedRevision),
      publishedAt: value.publishedAt,
    };
  }
  const baseKeys = ['name', 'slug', 'createdAtSql', 'updatedAtSql'];
  const appKeys = [
    'description',
    'website',
    'isPwa',
    'rating',
    'estimatedNumberOfUsers',
    'isSuspended',
    'logoUrl',
    'bannerUrl',
    'categoryId',
    'tagIds',
    'platformIds',
    'deviceIds',
    'monetizationModelIds',
    ...(Object.prototype.hasOwnProperty.call(value, 'classification')
      ? ['classification']
      : []),
  ];
  exactKeys(value, [
    ...baseKeys,
    ...(kind === 'app' ? appKeys : kind === 'category' ? ['parentId'] : []),
  ]);
  assertEditorialSnapshot(
    typeof value.name === 'string' &&
      (value.name.length > 0 ||
        (allowScrubbedApplication &&
          kind === 'app' &&
          [
            value.website,
            value.description,
            value.logoUrl,
            value.bannerUrl,
          ].every((field) => field === null))) &&
      value.name.length <= 255 &&
      value.name.trim() === value.name,
    'Invalid resource name'
  );
  assertEditorialSnapshot(
    typeof value.slug === 'string' &&
      value.slug.length <= 255 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug),
    'Invalid resource slug'
  );
  const base = {
    name: value.name,
    slug: value.slug,
    createdAtSql: calendar(value.createdAtSql),
    updatedAtSql: calendar(value.updatedAtSql),
  };
  if (kind === 'tag') return base;
  if (kind === 'category')
    return { ...base, parentId: reference(value.parentId) };
  assertEditorialSnapshot(
    typeof value.isPwa === 'boolean' && typeof value.isSuspended === 'boolean',
    'Invalid resource flags'
  );
  assertEditorialSnapshot(
    value.rating === null ||
      (typeof value.rating === 'number' &&
        Number.isFinite(value.rating) &&
        value.rating >= 0 &&
        value.rating <= 9.9),
    'Invalid stored rating'
  );
  assertEditorialSnapshot(
    value.estimatedNumberOfUsers === null ||
      (typeof value.estimatedNumberOfUsers === 'number' &&
        Number.isSafeInteger(value.estimatedNumberOfUsers) &&
        value.estimatedNumberOfUsers >= 0),
    'Invalid stored user count'
  );
  const app: EditorialAppContent = {
    ...base,
    description: text(value.description, 32768, true),
    website: text(value.website, 2048, true),
    logoUrl: text(value.logoUrl, 1020, true),
    bannerUrl: text(value.bannerUrl, 1020, true),
    isPwa: value.isPwa,
    isSuspended: value.isSuspended,
    rating: value.rating,
    estimatedNumberOfUsers: value.estimatedNumberOfUsers,
    categoryId: reference(value.categoryId),
    tagIds: ids(value.tagIds),
    platformIds: ids(value.platformIds),
    deviceIds: ids(value.deviceIds),
    monetizationModelIds: ids(value.monetizationModelIds),
    ...classificationFields(value.classification, InvalidEditorialSnapshot),
  };
  return app;
}

/** Canonical property/reference ordering makes replay independent of SQL row ordering. */
export function projectEditorialSnapshot(input: unknown): EditorialProjection {
  const value = object(input);
  exactKeys(value, [
    'kind',
    'resourceId',
    'tenantId',
    'revision',
    'deletedAt',
    'content',
  ]);
  const { kind, resourceId, tenantId, revision, deletedAt } = value;
  assertEditorialSnapshot(
    kind === 'app' ||
      kind === 'category' ||
      kind === 'tag' ||
      kind === 'suite' ||
      kind === 'article' ||
      kind === 'release',
    'Invalid resource kind'
  );
  assertEditorialSnapshot(
    isEditorialResourceId(resourceId) && isEditorialScope(tenantId),
    'Invalid authoritative resource scope'
  );
  assertEditorialSnapshot(
    typeof revision === 'number' &&
      Number.isSafeInteger(revision) &&
      revision > 0,
    'Invalid authoritative revision'
  );
  assertEditorialSnapshot(
    deletedAt === null ||
      (typeof deletedAt === 'number' &&
        Number.isSafeInteger(deletedAt) &&
        deletedAt >= 0),
    'Invalid tombstone'
  );
  assertEditorialSnapshot(
    deletedAt === null ? value.content !== null : value.content === null,
    'Tombstone/content mismatch'
  );
  const body: Omit<EditorialProjection, 'fingerprint'> = {
    _id: editorialProjectionId(kind, resourceId),
    schemaVersion: EDITORIAL_PROJECTION_SCHEMA,
    kind,
    resourceId,
    tenantId,
    revision,
    deletedAt,
    content:
      deletedAt === null ? parseEditorialContent(kind, value.content) : null,
  };
  const serialized = JSON.stringify(body);
  assertEditorialSnapshot(
    Buffer.byteLength(serialized) <= EDITORIAL_MAX_PROJECTION_BYTES,
    'Projection exceeds size limit'
  );
  return {
    ...body,
    fingerprint: createHash('sha256').update(serialized).digest('hex'),
  };
}

export function inspectEditorialProjection(
  input: unknown
): EditorialProjection {
  const value = object(input);
  exactKeys(value, [
    '_id',
    'schemaVersion',
    'fingerprint',
    'kind',
    'resourceId',
    'tenantId',
    'revision',
    'deletedAt',
    'content',
  ]);
  const expected = projectEditorialSnapshot({
    kind: value.kind,
    resourceId: value.resourceId,
    tenantId: value.tenantId,
    revision: value.revision,
    deletedAt: value.deletedAt,
    content: value.content,
  });
  assertEditorialSnapshot(
    value._id === expected._id &&
      value.schemaVersion === expected.schemaVersion &&
      value.fingerprint === expected.fingerprint,
    'Conflicting projection metadata or content'
  );
  return expected;
}

export async function materializeEditorial(
  request: {
    kind: EditorialProjectionKind;
    resourceId: string;
    tenantId: string;
    revision: number;
  },
  reader: EditorialSnapshotReader,
  store: EditorialProjectionStore
): Promise<EditorialPublicationOutcome> {
  const snapshot = await reader.read(request.kind, request.resourceId);
  const projection = projectEditorialSnapshot(snapshot);
  assertEditorialSnapshot(
    projection.kind === request.kind &&
      projection.resourceId === request.resourceId &&
      projection.tenantId === request.tenantId,
    'Snapshot does not match requested resource'
  );
  if (projection.revision < request.revision)
    throw new Error('Authoritative store has not reached requested revision');
  return store.publish(projection);
}
