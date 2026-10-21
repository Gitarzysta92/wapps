export const RELEASE_DRAFT_LIMIT = 100;
export const RELEASE_CHANGE_LIMIT = 100;
export const RELEASE_CONTENT_LIMIT = 16_000;
export const RELEASE_PAGE_SIZE = 20;

export type ReleaseChannel = 'stable' | 'prerelease';
export type ReleaseChangeType =
  | 'feature'
  | 'fix'
  | 'improvement'
  | 'breaking'
  | 'security';
export interface ReleaseFields {
  version: string;
  channel: ReleaseChannel;
  type: 'major' | 'minor' | 'patch';
  releasedOn: string;
  title: string;
  description: string;
  changes: { type: ReleaseChangeType; description: string }[];
}
export interface ReleaseTarget {
  applicationId: string;
  releaseId: string;
  claimId: string;
  sourcePublicationRevision: number | null;
}
export interface ReleaseDraft extends ReleaseFields {
  id: string;
  target: ReleaseTarget;
  revision: number;
  createdAt: number;
  updatedAt: number;
}
export interface ReleaseSource {
  applicationId: string;
  applicationName: string;
  claimId: string;
  release:
    | (ReleaseFields & { id: string; revision: number; visible: boolean })
    | null;
}
export interface ReleaseReceipt {
  id: string;
  revision: number;
  deleted: boolean;
}
export interface ReleaseSubmission extends ReleaseFields {
  target: ReleaseTarget;
  submittedRevision: number;
  submittedAt: number;
  reviewedAt: number | null;
  status: 'submitted' | 'approved' | 'rejected' | 'cancelled';
  reason: string;
}
export interface ReleasePublicationStatus {
  application?: { id: string; name: string; slug: string } | null;
  id: string;
  revision: number;
  publicationRevision: number | null;
  publishedSubmissionRevision: number | null;
  publicVersion: string | null;
  latestSubmission: ReleaseSubmission | null;
}
export type ReleasePublicationAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'withdraw';
export interface ReleasePublicationInput {
  expectedRevision: number;
  expectedPublicationRevision: number | null;
  submittedRevision: number | null;
  reason: string;
}
export interface ReleasePublicationReceipt {
  id: string;
  revision: number;
  releaseId: string;
  action: ReleasePublicationAction;
  submittedRevision: number | null;
  publicationRevision: number | null;
}
export interface PublishedRelease extends ReleaseFields {
  id: string;
  applicationId: string;
  applicationSlug: string;
  applicationName: string;
  revision: number;
  publishedAt: number;
}
export interface ReleasePage {
  items: PublishedRelease[];
  page: number;
  total: number;
}
export interface ReleaseBrowseFilter {
  channel?: ReleaseChannel;
  before?: string;
}
export function parseReleaseBrowseFilter(input: unknown): ReleaseBrowseFilter {
  const value = releaseObject(input, ['channel', 'before']);
  return {
    ...(value['channel'] === undefined
      ? {}
      : { channel: releaseChannel(value['channel']) }),
    ...(value['before'] === undefined
      ? {}
      : { before: releasedOn(value['before']) }),
  };
}
export interface ReleaseReviewPage {
  items: ReleasePublicationStatus[];
  page: number;
  total: number;
}
export class ReleaseInputError extends Error {}
export class ReleaseConflictError extends Error {}
export class ReleaseNotFoundError extends Error {}
export class ReleaseUnavailableError extends Error {}

export function releaseObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new ReleaseInputError('Unexpected release fields');
  return input as Record<string, unknown>;
}
export function releaseId(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input
    )
  )
    throw new ReleaseInputError('Invalid release identity');
  return input;
}
export function releaseRevision(input: unknown): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < 1 ||
    input >= Number.MAX_SAFE_INTEGER
  )
    throw new ReleaseInputError('Invalid release revision');
  return input;
}
export function releaseTimestamp(input: unknown): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < 0 ||
    input > 253_402_300_799_999
  )
    throw new ReleaseInputError('Invalid release timestamp');
  return input;
}
export function releaseVersion(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,79}$/.test(input)
  )
    throw new ReleaseInputError(
      'Use a version of 1-80 letters, numbers, dots, plus signs, underscores or hyphens'
    );
  return input;
}
export function releaseChannel(input: unknown): ReleaseChannel {
  if (input !== 'stable' && input !== 'prerelease')
    throw new ReleaseInputError('Choose stable or prerelease');
  return input;
}
function text(
  input: unknown,
  minimum: number,
  maximum: number,
  label: string
): string {
  if (
    typeof input !== 'string' ||
    [...input].some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })
  )
    throw new ReleaseInputError(`Invalid ${label}`);
  const value = input.trim();
  if (value.length < minimum || value.length > maximum)
    throw new ReleaseInputError(
      `${label} must contain ${minimum}-${maximum} characters`
    );
  return value;
}
function releasedOn(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input) ||
    input.startsWith('0000-')
  )
    throw new ReleaseInputError('Choose a release date as YYYY-MM-DD');
  const date = new Date(input + 'T00:00:00.000Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input
  )
    throw new ReleaseInputError('Choose a real calendar date');
  return input;
}
const fieldKeys = [
  'version',
  'channel',
  'type',
  'releasedOn',
  'title',
  'description',
  'changes',
] as const;
function fieldsFrom(value: Record<string, unknown>): ReleaseFields {
  const type = value['type'];
  if (type !== 'major' && type !== 'minor' && type !== 'patch')
    throw new ReleaseInputError('Choose a major, minor or patch release');
  const changes = value['changes'];
  if (
    !Array.isArray(changes) ||
    !changes.length ||
    changes.length > RELEASE_CHANGE_LIMIT
  )
    throw new ReleaseInputError(
      `Supply 1-${RELEASE_CHANGE_LIMIT} release changes`
    );
  const result: ReleaseFields = {
    version: releaseVersion(value['version']),
    channel: releaseChannel(value['channel']),
    type,
    releasedOn: releasedOn(value['releasedOn']),
    title: text(value['title'], 1, 160, 'Release title'),
    description: text(value['description'], 1, 4000, 'Release description'),
    changes: changes.map((input) => {
      const change = releaseObject(input, ['type', 'description']);
      const type = change['type'];
      if (
        type !== 'feature' &&
        type !== 'fix' &&
        type !== 'improvement' &&
        type !== 'breaking' &&
        type !== 'security'
      )
        throw new ReleaseInputError('Choose a supported change type');
      return {
        type,
        description: text(change['description'], 1, 1000, 'Change description'),
      };
    }),
  };
  // Bounding serialized UTF-16 also bounds the UTF-8 snapshot below the shared 128 KiB limit.
  if (JSON.stringify(result).length > RELEASE_CONTENT_LIMIT)
    throw new ReleaseInputError('Release notes are too long');
  return result;
}
export function parseReleaseFields(input: unknown): ReleaseFields {
  return fieldsFrom(releaseObject(input, fieldKeys));
}
export function parseReleaseTarget(input: unknown): ReleaseTarget {
  const value = releaseObject(input, [
    'applicationId',
    'releaseId',
    'claimId',
    'sourcePublicationRevision',
  ]);
  return {
    applicationId: releaseId(value['applicationId']),
    releaseId: releaseId(value['releaseId']),
    claimId: releaseId(value['claimId']),
    sourcePublicationRevision: optionalRevision(
      value['sourcePublicationRevision']
    ),
  };
}
export function parseReleaseSource(input: unknown): ReleaseSource {
  const value = releaseObject(input, [
    'applicationId',
    'applicationName',
    'claimId',
    'release',
  ]);
  let release: ReleaseSource['release'] = null;
  if (value['release'] !== null) {
    const stored = releaseObject(value['release'], [
      ...fieldKeys,
      'id',
      'revision',
      'visible',
    ]);
    if (typeof stored['visible'] !== 'boolean')
      throw new ReleaseInputError('Invalid release visibility');
    release = {
      ...fieldsFrom(stored),
      id: releaseId(stored['id']),
      revision: releaseRevision(stored['revision']),
      visible: stored['visible'],
    };
  }
  return {
    applicationId: releaseId(value['applicationId']),
    applicationName: text(value['applicationName'], 1, 255, 'Application name'),
    claimId: releaseId(value['claimId']),
    release,
  };
}
function optionalRevision(input: unknown) {
  return input === null ? null : releaseRevision(input);
}
export function parseReleaseDraft(input: unknown): ReleaseDraft {
  const value = releaseObject(input, [
    ...fieldKeys,
    'id',
    'target',
    'revision',
    'createdAt',
    'updatedAt',
  ]);
  const createdAt = releaseTimestamp(value['createdAt']);
  const updatedAt = releaseTimestamp(value['updatedAt']);
  if (updatedAt < createdAt)
    throw new ReleaseInputError('Release timestamps are out of order');
  return {
    ...fieldsFrom(value),
    id: releaseId(value['id']),
    target: parseReleaseTarget(value['target']),
    revision: releaseRevision(value['revision']),
    createdAt,
    updatedAt,
  };
}
export function parseReleaseReceipt(input: unknown): ReleaseReceipt {
  const value = releaseObject(input, ['id', 'revision', 'deleted']);
  if (typeof value['deleted'] !== 'boolean')
    throw new ReleaseInputError('Invalid release deletion receipt');
  return {
    id: releaseId(value['id']),
    revision: releaseRevision(value['revision']),
    deleted: value['deleted'],
  };
}
export function parseReleaseSubmission(input: unknown): ReleaseSubmission {
  const value = releaseObject(input, [
    ...fieldKeys,
    'target',
    'submittedRevision',
    'submittedAt',
    'reviewedAt',
    'status',
    'reason',
  ]);
  const status = value['status'];
  if (
    status !== 'submitted' &&
    status !== 'approved' &&
    status !== 'rejected' &&
    status !== 'cancelled'
  )
    throw new ReleaseInputError('Invalid release submission state');
  const submittedAt = releaseTimestamp(value['submittedAt']);
  const reviewedAt =
    value['reviewedAt'] === null ? null : releaseTimestamp(value['reviewedAt']);
  if (
    (status === 'submitted') !== (reviewedAt === null) ||
    (reviewedAt !== null && reviewedAt < submittedAt)
  )
    throw new ReleaseInputError('Inconsistent release review timestamps');
  const fields = fieldsFrom(value);
  if (fields.releasedOn > new Date(submittedAt).toISOString().slice(0, 10))
    throw new ReleaseInputError(
      'A release cannot be submitted before its release date'
    );
  const reason = text(
    value['reason'],
    status === 'rejected' ? 1 : 0,
    1000,
    'Review reason'
  );
  if ((status === 'submitted' || status === 'cancelled') && reason !== '')
    throw new ReleaseInputError(
      'An undecided release cannot have a review reason'
    );
  return {
    ...fields,
    target: parseReleaseTarget(value['target']),
    submittedRevision: releaseRevision(value['submittedRevision']),
    submittedAt,
    reviewedAt,
    status,
    reason,
  };
}
export function parseReleasePublicationStatus(
  input: unknown
): ReleasePublicationStatus {
  const value = releaseObject(input, [
    'application',
    'id',
    'revision',
    'publicationRevision',
    'publishedSubmissionRevision',
    'publicVersion',
    'latestSubmission',
  ]);
  const revision = releaseRevision(value['revision']);
  const publicationRevision = optionalRevision(value['publicationRevision']);
  const publishedSubmissionRevision = optionalRevision(
    value['publishedSubmissionRevision']
  );
  const publicVersion =
    value['publicVersion'] === null
      ? null
      : releaseVersion(value['publicVersion']);
  const latestSubmission =
    value['latestSubmission'] === null
      ? null
      : parseReleaseSubmission(value['latestSubmission']);
  const application =
    value['application'] === undefined || value['application'] === null
      ? null
      : releaseObject(value['application'], ['id', 'name', 'slug']);
  if (
    application &&
    (typeof application['slug'] !== 'string' ||
      application['slug'].length > 255 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(application['slug']) ||
      (latestSubmission &&
        application['id'] !== latestSubmission.target.applicationId))
  )
    throw new ReleaseInputError('Invalid release application context');
  if (
    (latestSubmission && latestSubmission.submittedRevision >= revision) ||
    (publishedSubmissionRevision !== null &&
      (publicationRevision === null ||
        publicVersion === null ||
        publishedSubmissionRevision >= revision)) ||
    (publicVersion !== null && publicationRevision === null)
  )
    throw new ReleaseInputError('Inconsistent release publication state');
  return {
    ...(value['application'] === undefined
      ? {}
      : {
          application: application
            ? {
                id: releaseId(application['id']),
                name: text(application['name'], 1, 255, 'Application name'),
                slug: String(application['slug']),
              }
            : null,
        }),
    id: releaseId(value['id']),
    revision,
    publicationRevision,
    publishedSubmissionRevision,
    publicVersion,
    latestSubmission,
  };
}
export function parseReleasePublicationInput(
  action: ReleasePublicationAction,
  input: unknown
): ReleasePublicationInput {
  if (!['submit', 'approve', 'reject', 'withdraw'].includes(action))
    throw new ReleaseInputError('Invalid release publication action');
  const review = action === 'approve' || action === 'reject';
  const value = releaseObject(input, [
    'expectedRevision',
    'expectedPublicationRevision',
    ...(review ? ['submittedRevision', 'reason'] : []),
  ]);
  return {
    expectedRevision: releaseRevision(value['expectedRevision']),
    expectedPublicationRevision: optionalRevision(
      value['expectedPublicationRevision']
    ),
    submittedRevision: review
      ? releaseRevision(value['submittedRevision'])
      : null,
    reason: review
      ? text(
          value['reason'] ?? '',
          action === 'reject' ? 1 : 0,
          1000,
          'Review reason'
        )
      : '',
  };
}
export function assertReleaseSubmissionDate(fields: ReleaseFields, at: number) {
  releaseTimestamp(at);
  if (fields.releasedOn > new Date(at).toISOString().slice(0, 10))
    throw new ReleaseInputError(
      'Publish release notes on or after the stated release date'
    );
}
export function assertReleaseVersion(
  fields: ReleaseFields,
  canonicalVersion: string | null
) {
  if (canonicalVersion !== null && fields.version !== canonicalVersion)
    throw new ReleaseConflictError(
      'A published version URL cannot be renamed. Create a new release instead.'
    );
}
export function assertReleasePublicationTransition(
  action: ReleasePublicationAction,
  status: ReleasePublicationStatus,
  input: ReleasePublicationInput
) {
  if (
    input.expectedRevision !== status.revision ||
    input.expectedPublicationRevision !== status.publicationRevision
  )
    throw new ReleaseConflictError(
      'This draft or public release changed. Reload before continuing.'
    );
  if (action === 'submit') {
    if (status.latestSubmission?.status === 'submitted')
      throw new ReleaseConflictError(
        'A release submission is already awaiting review'
      );
  } else if (action === 'approve' || action === 'reject') {
    if (
      status.latestSubmission?.status !== 'submitted' ||
      status.latestSubmission.submittedRevision !== input.submittedRevision
    )
      throw new ReleaseConflictError(
        'The selected release submission is no longer pending'
      );
    if (
      action === 'approve' &&
      status.latestSubmission.target.sourcePublicationRevision !==
        status.publicationRevision
    )
      throw new ReleaseConflictError(
        'Public release notes changed. Rebase and resubmit before approval.'
      );
  } else if (action === 'withdraw') {
    if (
      status.publicVersion === null &&
      status.latestSubmission?.status !== 'submitted'
    )
      throw new ReleaseConflictError(
        'There is no public or pending release to withdraw'
      );
  } else throw new ReleaseInputError('Invalid release publication action');
}
export function parseReleasePublicationReceipt(
  input: unknown
): ReleasePublicationReceipt {
  const value = releaseObject(input, [
    'id',
    'revision',
    'releaseId',
    'action',
    'submittedRevision',
    'publicationRevision',
  ]);
  const action = value['action'];
  if (
    action !== 'submit' &&
    action !== 'approve' &&
    action !== 'reject' &&
    action !== 'withdraw'
  )
    throw new ReleaseInputError('Invalid release publication receipt');
  const revision = releaseRevision(value['revision']);
  const submittedRevision = optionalRevision(value['submittedRevision']);
  const publicationRevision = optionalRevision(value['publicationRevision']);
  if (
    (action !== 'withdraw' && submittedRevision === null) ||
    (submittedRevision !== null && submittedRevision >= revision) ||
    (action === 'submit' && submittedRevision !== revision - 1) ||
    (action === 'approve' && publicationRevision === null)
  )
    throw new ReleaseInputError('Inconsistent release publication receipt');
  return {
    id: releaseId(value['id']),
    releaseId: releaseId(value['releaseId']),
    revision,
    action,
    submittedRevision,
    publicationRevision,
  };
}
export function parsePublishedRelease(input: unknown): PublishedRelease {
  const value = releaseObject(input, [
    ...fieldKeys,
    'id',
    'applicationId',
    'applicationSlug',
    'applicationName',
    'revision',
    'publishedAt',
  ]);
  const applicationSlug = value['applicationSlug'];
  if (
    typeof applicationSlug !== 'string' ||
    applicationSlug.length > 255 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(applicationSlug)
  )
    throw new ReleaseInputError('Invalid application slug');
  const fields = fieldsFrom(value);
  const publishedAt = releaseTimestamp(value['publishedAt']);
  assertReleaseSubmissionDate(fields, publishedAt);
  return {
    ...fields,
    id: releaseId(value['id']),
    applicationId: releaseId(value['applicationId']),
    applicationSlug,
    applicationName: text(value['applicationName'], 1, 255, 'Application name'),
    revision: releaseRevision(value['revision']),
    publishedAt,
  };
}
export function parseReleasePage(input: unknown): ReleasePage {
  const value = releaseObject(input, ['items', 'page', 'total']);
  const page = releaseRevision(value['page']),
    total = value['total'];
  if (
    page > 10000 ||
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(value['items']) ||
    value['items'].length > RELEASE_PAGE_SIZE
  )
    throw new ReleaseInputError('Invalid release page');
  const items = value['items'].map(parsePublishedRelease);
  if (
    items.length > Math.max(0, total - (page - 1) * RELEASE_PAGE_SIZE) ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    new Set(items.map((item) => item.applicationId)).size > 1
  )
    throw new ReleaseInputError('Inconsistent release page');
  return { items, page, total };
}
export function parseReleaseReviewPage(input: unknown): ReleaseReviewPage {
  const value = releaseObject(input, ['items', 'page', 'total']);
  const page = releaseRevision(value['page']),
    total = value['total'];
  if (
    page > 10000 ||
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(value['items']) ||
    value['items'].length > RELEASE_PAGE_SIZE
  )
    throw new ReleaseInputError('Invalid release review page');
  const items = value['items'].map(parseReleasePublicationStatus);
  if (
    items.length > Math.max(0, total - (page - 1) * RELEASE_PAGE_SIZE) ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.some((item) => item.latestSubmission?.status !== 'submitted')
  )
    throw new ReleaseInputError('Inconsistent release review page');
  return { items, page, total };
}
