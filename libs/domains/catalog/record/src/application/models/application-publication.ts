import {
  applicationDraftId,
  applicationDraftObject,
  applicationDraftRevision,
  parseApplicationDraftFields,
  parseApplicationEditingTarget,
  ApplicationDraftInputError,
  ApplicationDraftConflictError,
  type ApplicationDraftFields,
  type ApplicationEditingTarget,
} from './application-draft';
import { catalogSlug } from './catalog-read';
import {
  parseApplicationImageSet,
  type ApplicationImageSet,
} from '@domains/catalog/media';

export type ApplicationPublicationAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'withdraw';
export interface ApplicationSubmission extends ApplicationDraftFields {
  /** Null identifies historic submissions without a recorded image snapshot. */
  images?: ApplicationImageSet | null;
  submittedRevision: number;
  basePublicationRevision: number | null;
  status: 'submitted' | 'approved' | 'rejected' | 'cancelled';
  submittedAt: number;
  reviewedAt: number | null;
  reason: string;
}
export interface ApplicationPublicationStatus {
  id: string;
  revision: number;
  publicationRevision: number | null;
  publishedSubmissionRevision: number | null;
  publicSlug: string | null;
  latestSubmission: ApplicationSubmission | null;
  editing?: ApplicationEditingTarget;
}
export interface ApplicationPublicationInput {
  expectedRevision: number;
  submittedRevision: number | null;
  reason: string;
}
export interface ApplicationPublicationReceipt {
  id: string;
  revision: number;
  action: ApplicationPublicationAction;
  submittedRevision: number | null;
  publicationRevision: number | null;
}
export interface ApplicationReviewPage {
  items: ApplicationPublicationStatus[];
  page: number;
  total: number;
}

const optionalRevision = (value: unknown) =>
  value === null ? null : applicationDraftRevision(value);
function reason(value: unknown, required: boolean): string {
  if (
    typeof value !== 'string' ||
    value.length > 1000 ||
    (required && !value.trim()) ||
    [...value].some(
      (c) =>
        c.charCodeAt(0) === 127 ||
        (c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)))
    )
  )
    throw new ApplicationDraftInputError(
      'A rejection needs a reason of 1-1000 characters'
    );
  return value.trim();
}
function timestamp(value: unknown): number {
  const at = applicationDraftRevision(value);
  if (at > 8_640_000_000_000_000)
    throw new ApplicationDraftInputError('Invalid publication timestamp');
  return at;
}
export function parseApplicationPublicationInput(
  action: ApplicationPublicationAction,
  input: unknown
): ApplicationPublicationInput {
  const reviewing = action === 'approve' || action === 'reject';
  const value = applicationDraftObject(
    input,
    reviewing
      ? ['expectedRevision', 'submittedRevision', 'reason']
      : ['expectedRevision']
  );
  return {
    expectedRevision: applicationDraftRevision(value['expectedRevision']),
    submittedRevision: reviewing
      ? applicationDraftRevision(value['submittedRevision'])
      : null,
    reason: reviewing ? reason(value['reason'] ?? '', action === 'reject') : '',
  };
}
/** Review targets frozen content; replacing public content also requires its unchanged canonical revision. */
export function assertApplicationPublicationTransition(
  action: ApplicationPublicationAction,
  status: ApplicationPublicationStatus,
  input: ApplicationPublicationInput
) {
  if (
    input.expectedRevision !== status.revision ||
    !Number.isSafeInteger(status.revision + 1)
  )
    throw new ApplicationDraftConflictError(
      'The application draft changed. Reload before continuing.'
    );
  const pending = status.latestSubmission?.status === 'submitted';
  if (
    action === 'submit' &&
    pending &&
    status.latestSubmission?.images !== null
  )
    throw new ApplicationDraftConflictError(
      'This draft is already awaiting review'
    );
  if (
    (action === 'approve' || action === 'reject') &&
    (!pending ||
      status.latestSubmission?.submittedRevision !== input.submittedRevision)
  )
    throw new ApplicationDraftConflictError(
      'This submission is no longer awaiting review'
    );
  if (action === 'approve' && status.latestSubmission?.images === null)
    throw new ApplicationDraftConflictError(
      'This older submission has no image snapshot. The owner must resubmit before approval.'
    );
  if (
    action === 'approve' &&
    status.latestSubmission?.basePublicationRevision !==
      status.publicationRevision
  )
    throw new ApplicationDraftConflictError(
      'The public application changed after submission. Withdraw and submit a new revision.'
    );
  if (action === 'withdraw' && !pending && status.publicSlug === null)
    throw new ApplicationDraftConflictError(
      'There is no pending or public application to withdraw'
    );
}
export function parseApplicationSubmission(
  input: unknown
): ApplicationSubmission {
  const value = applicationDraftObject(input, [
    'name',
    'slug',
    'website',
    'description',
    'classification',
    'submittedRevision',
    'basePublicationRevision',
    'status',
    'submittedAt',
    'reviewedAt',
    'reason',
    'images',
  ]);
  const status = value['status'];
  if (
    status !== 'submitted' &&
    status !== 'approved' &&
    status !== 'rejected' &&
    status !== 'cancelled'
  )
    throw new ApplicationDraftInputError(
      'Invalid application submission status'
    );
  const submittedAt = timestamp(value['submittedAt']);
  const reviewedAt =
    value['reviewedAt'] === null ? null : timestamp(value['reviewedAt']);
  if (
    (status === 'submitted') !== (reviewedAt === null) ||
    (reviewedAt !== null && reviewedAt < submittedAt)
  )
    throw new ApplicationDraftInputError(
      'Invalid application review timestamp'
    );
  return {
    ...parseApplicationDraftFields({
      name: value['name'],
      slug: value['slug'],
      website: value['website'],
      description: value['description'],
      classification: value['classification'],
    }),
    submittedRevision: applicationDraftRevision(value['submittedRevision']),
    ...(value['images'] === undefined
      ? {}
      : {
          images:
            value['images'] === null
              ? null
              : parseApplicationImageSet(value['images']),
        }),
    basePublicationRevision: optionalRevision(value['basePublicationRevision']),
    status,
    submittedAt,
    reviewedAt,
    reason: reason(value['reason'], status === 'rejected'),
  };
}
export function parseApplicationPublicationStatus(
  input: unknown
): ApplicationPublicationStatus {
  const value = applicationDraftObject(input, [
    'id',
    'revision',
    'publicationRevision',
    'publishedSubmissionRevision',
    'publicSlug',
    'latestSubmission',
    'editing',
  ]);
  const revision = applicationDraftRevision(value['revision']);
  const publicationRevision = optionalRevision(value['publicationRevision']);
  const publishedSubmissionRevision = optionalRevision(
    value['publishedSubmissionRevision']
  );
  const publicSlug =
    value['publicSlug'] === null ? null : catalogSlug(value['publicSlug']);
  const latestSubmission =
    value['latestSubmission'] === null
      ? null
      : parseApplicationSubmission(value['latestSubmission']);
  if (
    (publicSlug !== null && publicationRevision === null) ||
    (publishedSubmissionRevision !== null &&
      (publicSlug === null || publishedSubmissionRevision >= revision)) ||
    (latestSubmission && latestSubmission.submittedRevision >= revision)
  )
    throw new ApplicationDraftInputError(
      'Invalid application publication revisions'
    );
  return {
    id: applicationDraftId(value['id']),
    revision,
    publicationRevision,
    publishedSubmissionRevision,
    publicSlug,
    latestSubmission,
    ...(value['editing'] === undefined
      ? {}
      : { editing: parseApplicationEditingTarget(value['editing']) }),
  };
}
export function parseApplicationPublicationReceipt(
  input: unknown
): ApplicationPublicationReceipt {
  const value = applicationDraftObject(input, [
    'id',
    'revision',
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
    throw new ApplicationDraftInputError(
      'Invalid application publication action'
    );
  const revision = applicationDraftRevision(value['revision']);
  const submittedRevision = optionalRevision(value['submittedRevision']);
  const publicationRevision = optionalRevision(value['publicationRevision']);
  if (
    revision < 2 ||
    (submittedRevision !== null && submittedRevision >= revision) ||
    (action !== 'withdraw' && submittedRevision === null) ||
    (action === 'submit' && submittedRevision !== revision - 1) ||
    (action === 'approve' && publicationRevision === null)
  )
    throw new ApplicationDraftInputError(
      'Invalid application publication receipt revisions'
    );
  return {
    id: applicationDraftId(value['id']),
    revision,
    action,
    submittedRevision,
    publicationRevision,
  };
}
export function parseApplicationReviewPage(
  input: unknown
): ApplicationReviewPage {
  const value = applicationDraftObject(input, ['items', 'page', 'total']);
  if (
    !Array.isArray(value['items']) ||
    value['items'].length > 20 ||
    typeof value['total'] !== 'number' ||
    !Number.isSafeInteger(value['total']) ||
    value['total'] < 0
  )
    throw new ApplicationDraftInputError('Invalid application review page');
  const items = value['items'].map(parseApplicationPublicationStatus);
  const page = applicationDraftRevision(value['page']);
  if (
    page > 10000 ||
    items.length > value['total'] ||
    items.some((item) => item.latestSubmission?.status !== 'submitted') ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new ApplicationDraftInputError('Invalid application review queue');
  return { items, page, total: value['total'] };
}
