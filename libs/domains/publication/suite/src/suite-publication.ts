import {
  parseSuiteFields,
  suiteId,
  suiteObject,
  suiteRevision,
  SuiteConflictError,
  SuiteInputError,
  type SuiteFields,
} from './private-suite';

export type SuitePublicationAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'withdraw';
export type SuiteSubmissionStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface SuiteSubmission extends SuiteFields {
  submittedRevision: number;
  status: SuiteSubmissionStatus;
  submittedAt: number;
  reviewedAt: number | null;
  reason: string;
}

export interface SuitePublicationStatus {
  id: string;
  revision: number;
  publicationRevision: number | null;
  publishedSubmissionRevision: number | null;
  latestSubmission: SuiteSubmission | null;
}

export interface SuitePublicationReceipt {
  id: string;
  revision: number;
  action: SuitePublicationAction;
  submittedRevision: number | null;
  publicationRevision: number | null;
}

export interface PublicSuite extends SuiteFields {
  id: string;
  revision: number;
  submittedRevision: number;
  publishedAt: number;
}

export interface PublicSuitePage {
  items: PublicSuite[];
  page: number;
  total: number;
  pageSize?: number;
}

export const SUITE_SELECTION_LIMIT = 50;

export function publicSuiteSelectionIds(input: unknown): string[] {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > SUITE_SELECTION_LIMIT
  )
    throw new SuiteInputError('Select between 1 and 50 suite IDs');
  return [...new Set(input.map(suiteId))];
}

export function parsePublicSuiteSelectionQuery(input: unknown): string[] {
  const value = suiteObject(input, ['ids']);
  if (typeof value['ids'] !== 'string' || value['ids'].length > 1849)
    throw new SuiteInputError('Expected a bounded list of suite IDs');
  return publicSuiteSelectionIds(value['ids'].split(','));
}

export function parsePublicSuiteSelection(
  input: unknown,
  requested: readonly string[]
): { items: PublicSuite[] } {
  const ids = new Set(publicSuiteSelectionIds(requested));
  const value = suiteObject(input, ['items']);
  if (!Array.isArray(value['items']) || value['items'].length > ids.size)
    throw new SuiteInputError('Invalid suite selection');
  const items = value['items'].map(parsePublicSuite);
  if (
    items.some((item) => !ids.has(item.id)) ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new SuiteInputError('Invalid suite selection members');
  return { items };
}

export interface SuiteReviewPage {
  items: SuitePublicationStatus[];
  page: number;
  total: number;
}

export function parseSuiteReviewPage(input: unknown): SuiteReviewPage {
  const value = suiteObject(input, ['items', 'page', 'total']);
  if (
    !Array.isArray(value['items']) ||
    value['items'].length > 20 ||
    typeof value['total'] !== 'number' ||
    !Number.isSafeInteger(value['total']) ||
    value['total'] < 0
  )
    throw new SuiteInputError('Invalid suite review page');
  const items = value['items'].map(parseSuitePublicationStatus);
  if (
    items.some((item) => item.latestSubmission?.status !== 'submitted') ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.length > value['total']
  )
    throw new SuiteInputError('Invalid pending suite reviews');
  return { items, page: suiteRevision(value['page']), total: value['total'] };
}

export interface PublicSuiteQuery {
  q: string;
  page: number;
  pageSize?: number;
  sort?: 'name' | 'name-desc' | 'newest';
}

export function parsePublicSuiteQuery(input: unknown): PublicSuiteQuery {
  const value = suiteObject(input, ['q', 'page', 'pageSize', 'sort']);
  if (
    value['q'] !== undefined &&
    (typeof value['q'] !== 'string' ||
      value['q'].length > 100 ||
      [...value['q']].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ))
  )
    throw new SuiteInputError('Suite search must be at most 100 characters');
  if (
    value['page'] !== undefined &&
    (typeof value['page'] !== 'string' ||
      !/^[1-9][0-9]{0,4}$/.test(value['page']) ||
      Number(value['page']) > 10000)
  )
    throw new SuiteInputError('Invalid suite page');
  const size = value['pageSize'],
    sort = value['sort'];
  if (
    size !== undefined &&
    (typeof size !== 'string' ||
      !/^[1-9][0-9]{0,2}$/.test(size) ||
      Number(size) > 100)
  )
    throw new SuiteInputError('Invalid suite page size');
  if (
    sort !== undefined &&
    sort !== 'name' &&
    sort !== 'name-desc' &&
    sort !== 'newest'
  )
    throw new SuiteInputError('Invalid suite sort');
  return {
    q: typeof value['q'] === 'string' ? value['q'].trim() : '',
    page: value['page'] === undefined ? 1 : Number(value['page']),
    ...(size === undefined ? {} : { pageSize: Number(size) }),
    ...(sort === undefined ? {} : { sort }),
  };
}

export function parsePublicSuitePage(input: unknown): PublicSuitePage {
  const value = suiteObject(input, ['items', 'page', 'total', 'pageSize']);
  const pageSize =
    value['pageSize'] === undefined ? 20 : suiteRevision(value['pageSize']);
  const page = suiteRevision(value['page']);
  if (
    pageSize > 100 ||
    page > 10000 ||
    !Array.isArray(value['items']) ||
    value['items'].length > pageSize ||
    typeof value['total'] !== 'number' ||
    !Number.isSafeInteger(value['total']) ||
    value['total'] < 0
  )
    throw new SuiteInputError('Invalid suite page response');
  const items = value['items'].map(parsePublicSuite);
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.length > Math.max(0, value['total'] - (page - 1) * pageSize)
  )
    throw new SuiteInputError('Invalid suite page members');
  return {
    items,
    total: value['total'],
    page,
    ...(value['pageSize'] === undefined ? {} : { pageSize }),
  };
}

export interface SuitePublicationInput {
  expectedRevision: number;
  submittedRevision: number | null;
  reason: string;
}

export function parseSuitePublicationInput(
  action: SuitePublicationAction,
  input: unknown
): SuitePublicationInput {
  const reviewing = action === 'approve' || action === 'reject';
  const data = suiteObject(
    input,
    reviewing
      ? ['expectedRevision', 'submittedRevision', 'reason']
      : ['expectedRevision']
  );
  const reason = data['reason'] ?? '';
  if (
    typeof reason !== 'string' ||
    reason.trim().length > 1000 ||
    [...reason].some((character) => {
      const code = character.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    }) ||
    (action === 'reject' && !reason.trim())
  )
    throw new SuiteInputError(
      'A rejection needs a reason of 1-1000 characters'
    );
  return {
    expectedRevision: suiteRevision(data['expectedRevision']),
    submittedRevision: reviewing
      ? suiteRevision(data['submittedRevision'])
      : null,
    reason: reason.trim(),
  };
}

/** A review always targets the frozen submission, even when the draft has changed. */
export function assertSuitePublicationTransition(
  action: SuitePublicationAction,
  status: SuitePublicationStatus,
  input: SuitePublicationInput
): void {
  if (status.revision !== input.expectedRevision)
    throw new SuiteConflictError('Suite changed. Reload before continuing.');
  if (!Number.isSafeInteger(status.revision + 1))
    throw new SuiteConflictError('Suite revision limit reached');
  const pending = status.latestSubmission?.status === 'submitted';
  if (action === 'submit' && pending)
    throw new SuiteConflictError(
      'This suite already has a submission awaiting review'
    );
  if (
    (action === 'approve' || action === 'reject') &&
    (!pending ||
      status.latestSubmission?.submittedRevision !== input.submittedRevision)
  )
    throw new SuiteConflictError(
      'This submission is no longer awaiting review'
    );
  if (
    action === 'withdraw' &&
    !pending &&
    status.publishedSubmissionRevision === null
  )
    throw new SuiteConflictError(
      'There is no pending or published submission to withdraw'
    );
}

function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new SuiteInputError('Invalid suite timestamp');
  return value;
}

export function parseSuiteSubmission(input: unknown): SuiteSubmission {
  const value = suiteObject(input, [
    'title',
    'description',
    'applicationIds',
    'classification',
    'submittedRevision',
    'status',
    'submittedAt',
    'reviewedAt',
    'reason',
  ]);
  const { status } = value;
  if (
    status !== 'submitted' &&
    status !== 'approved' &&
    status !== 'rejected' &&
    status !== 'cancelled'
  )
    throw new SuiteInputError('Invalid suite submission status');
  const fields = parseSuiteFields({
    title: value['title'],
    description: value['description'],
    applicationIds: value['applicationIds'],
    classification: value['classification'],
  });
  const submittedAt = timestamp(value['submittedAt']);
  const reviewedAt =
    value['reviewedAt'] === null ? null : timestamp(value['reviewedAt']);
  if (
    (status === 'submitted') !== (reviewedAt === null) ||
    (reviewedAt !== null && reviewedAt < submittedAt) ||
    typeof value['reason'] !== 'string' ||
    value['reason'].length > 1000 ||
    (status === 'rejected' && !value['reason'].trim())
  )
    throw new SuiteInputError('Invalid suite review');
  return {
    ...fields,
    submittedRevision: suiteRevision(value['submittedRevision']),
    status,
    submittedAt,
    reviewedAt,
    reason: value['reason'],
  };
}

export function parseSuitePublicationStatus(
  input: unknown
): SuitePublicationStatus {
  const value = suiteObject(input, [
    'id',
    'revision',
    'publicationRevision',
    'publishedSubmissionRevision',
    'latestSubmission',
  ]);
  const revision = suiteRevision(value['revision']);
  const publishedSubmissionRevision =
    value['publishedSubmissionRevision'] === null
      ? null
      : suiteRevision(value['publishedSubmissionRevision']);
  const publicationRevision =
    value['publicationRevision'] === null
      ? null
      : suiteRevision(value['publicationRevision']);
  const latestSubmission =
    value['latestSubmission'] === null
      ? null
      : parseSuiteSubmission(value['latestSubmission']);
  if (
    (publishedSubmissionRevision !== null &&
      (publicationRevision === null ||
        publishedSubmissionRevision >= revision)) ||
    (latestSubmission && latestSubmission.submittedRevision >= revision)
  )
    throw new SuiteInputError('Invalid suite publication revisions');
  return {
    id: suiteId(value['id']),
    revision,
    publicationRevision,
    publishedSubmissionRevision,
    latestSubmission,
  };
}

export function parseSuitePublicationReceipt(
  input: unknown
): SuitePublicationReceipt {
  const value = suiteObject(input, [
    'id',
    'revision',
    'action',
    'submittedRevision',
    'publicationRevision',
  ]);
  const { action } = value;
  if (
    action !== 'submit' &&
    action !== 'approve' &&
    action !== 'reject' &&
    action !== 'withdraw'
  )
    throw new SuiteInputError('Invalid suite publication action');
  return {
    id: suiteId(value['id']),
    revision: suiteRevision(value['revision']),
    action,
    submittedRevision:
      value['submittedRevision'] === null
        ? null
        : suiteRevision(value['submittedRevision']),
    publicationRevision:
      value['publicationRevision'] === null
        ? null
        : suiteRevision(value['publicationRevision']),
  };
}

export function parsePublicSuite(input: unknown): PublicSuite {
  const value = suiteObject(input, [
    'id',
    'revision',
    'submittedRevision',
    'publishedAt',
    'title',
    'description',
    'applicationIds',
    'classification',
  ]);
  return {
    ...parseSuiteFields({
      title: value['title'],
      description: value['description'],
      applicationIds: value['applicationIds'],
      classification: value['classification'],
    }),
    id: suiteId(value['id']),
    revision: suiteRevision(value['revision']),
    submittedRevision: suiteRevision(value['submittedRevision']),
    publishedAt: timestamp(value['publishedAt']),
  };
}
