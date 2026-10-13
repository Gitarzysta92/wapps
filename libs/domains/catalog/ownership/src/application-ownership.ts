export const OWNERSHIP_CHALLENGE_LIFETIME = 7 * 24 * 60 * 60 * 1000;
export const OWNERSHIP_PROOF_FRESHNESS = 24 * 60 * 60 * 1000;
export const OWNERSHIP_CHECK_INTERVAL = 30 * 1000;
export const OWNERSHIP_CHECK_LIMIT = 10;
export const OWNERSHIP_PENDING_LIMIT = 20;

export class OwnershipInputError extends Error {}
export class OwnershipConflictError extends Error {}
export class OwnershipNotFoundError extends Error {}
export class OwnershipUnavailableError extends Error {}
export class OwnershipRateLimitError extends Error {}

export type OwnershipStatus =
  | 'awaiting-proof'
  | 'awaiting-review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'revoked';
export type OwnershipAction =
  | 'create'
  | 'verify'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'release'
  | 'revoke';
export interface OwnershipClaimInput {
  applicationId: string;
  evidenceUrl: string;
  notes: string;
}
export interface OwnershipClaim extends OwnershipClaimInput {
  id: string;
  claimantIdentityId: string;
  revision: number;
  applicationRevision: number;
  applicationName: string;
  applicationSlug: string;
  website: string;
  hostname: string;
  challengeName: string;
  challengeValue: string;
  status: OwnershipStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  verifiedAt: number | null;
  reviewedAt: number | null;
  reason: string;
}
export interface OwnershipChangeInput {
  expectedRevision: number;
  reason: string;
}
export interface OwnershipReceipt {
  id: string;
  revision: number;
  action: OwnershipAction;
  status: OwnershipStatus;
  proofMatched: boolean | null;
  applicationRevision: number | null;
}
export interface OwnershipPage {
  items: OwnershipClaim[];
  page: number;
  total: number;
}

export function ownershipObject(input: unknown, fields: string[]) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.includes(key))
  )
    throw new OwnershipInputError('Unexpected ownership input');
  return input as Record<string, unknown>;
}
function text(
  input: unknown,
  minimum: number,
  maximum: number,
  multiline = false
): string {
  if (
    typeof input !== 'string' ||
    input.length > maximum ||
    input.trim().length < minimum ||
    [...input].some(
      (c) =>
        c.charCodeAt(0) === 127 ||
        (c.charCodeAt(0) < 32 &&
          !(multiline && [9, 10, 13].includes(c.charCodeAt(0))))
    )
  )
    throw new OwnershipInputError('Invalid ownership text');
  return input.trim();
}
export function ownershipIdentity(input: unknown): string {
  const identity = text(input, 1, 128);
  if (input !== identity)
    throw new OwnershipInputError('Invalid ownership identity');
  return identity;
}
export function ownershipId(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      input
    )
  )
    throw new OwnershipInputError('Invalid ownership identifier');
  return input;
}
export function ownershipRevision(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1)
    throw new OwnershipInputError('Invalid ownership revision');
  return input;
}
export function ownershipTime(input: unknown): number {
  const at = ownershipRevision(input);
  if (at > 8_640_000_000_000_000)
    throw new OwnershipInputError('Invalid ownership timestamp');
  return at;
}
function url(input: unknown): string {
  const value = text(input, 1, 2048);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new OwnershipInputError('Invalid ownership URL');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new OwnershipInputError(
      'Ownership URLs must use HTTP(S) without credentials'
    );
  return value;
}
/** Proof is bound to the exact canonical website host, never a claimant-selected replacement. */
export function ownershipHostname(website: string): string {
  const hostname = new URL(url(website)).hostname
    .toLowerCase()
    .replace(/\.$/, '');
  if (
    hostname.length > 235 ||
    !hostname.includes('.') ||
    hostname
      .split('.')
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    /^[0-9.]+$/.test(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  )
    throw new OwnershipInputError(
      'This website needs a DNS hostname before domain ownership can be verified'
    );
  return hostname;
}
export function parseOwnershipClaimInput(input: unknown): OwnershipClaimInput {
  const value = ownershipObject(input, [
    'applicationId',
    'evidenceUrl',
    'notes',
  ]);
  return {
    applicationId: ownershipId(value['applicationId']),
    evidenceUrl: url(value['evidenceUrl']),
    notes: text(value['notes'], 20, 2000, true),
  };
}
export function parseOwnershipChangeInput(
  action: Exclude<OwnershipAction, 'create'>,
  input: unknown
): OwnershipChangeInput {
  const acceptsReason = ['approve', 'reject', 'revoke', 'release'].includes(
    action
  );
  const value = ownershipObject(
    input,
    acceptsReason ? ['expectedRevision', 'reason'] : ['expectedRevision']
  );
  return {
    expectedRevision: ownershipRevision(value['expectedRevision']),
    reason: acceptsReason
      ? text(
          value['reason'] ?? '',
          ['reject', 'revoke'].includes(action) ? 1 : 0,
          1000,
          true
        )
      : '',
  };
}
function status(input: unknown): OwnershipStatus {
  if (
    input !== 'awaiting-proof' &&
    input !== 'awaiting-review' &&
    input !== 'approved' &&
    input !== 'rejected' &&
    input !== 'cancelled' &&
    input !== 'revoked'
  )
    throw new OwnershipInputError('Invalid ownership status');
  return input;
}
export function parseOwnershipClaim(input: unknown): OwnershipClaim {
  const value = ownershipObject(input, [
    'id',
    'applicationId',
    'claimantIdentityId',
    'revision',
    'applicationRevision',
    'applicationName',
    'applicationSlug',
    'website',
    'hostname',
    'evidenceUrl',
    'notes',
    'challengeName',
    'challengeValue',
    'status',
    'createdAt',
    'updatedAt',
    'expiresAt',
    'verifiedAt',
    'reviewedAt',
    'reason',
  ]);
  const website = url(value['website']);
  const hostname = ownershipHostname(website);
  const current = status(value['status']);
  const createdAt = ownershipTime(value['createdAt']);
  const updatedAt = ownershipTime(value['updatedAt']);
  const expiresAt = ownershipTime(value['expiresAt']);
  const verifiedAt =
    value['verifiedAt'] === null ? null : ownershipTime(value['verifiedAt']);
  const reviewedAt =
    value['reviewedAt'] === null ? null : ownershipTime(value['reviewedAt']);
  if (
    value['hostname'] !== hostname ||
    value['challengeName'] !== '_wapps-ownership.' + hostname ||
    typeof value['challengeValue'] !== 'string' ||
    !/^wapps-ownership=[0-9a-f]{64}$/.test(value['challengeValue']) ||
    updatedAt < createdAt ||
    expiresAt !== createdAt + OWNERSHIP_CHALLENGE_LIFETIME ||
    (verifiedAt !== null &&
      (verifiedAt < createdAt ||
        verifiedAt > updatedAt ||
        verifiedAt >= expiresAt)) ||
    (reviewedAt !== null &&
      (reviewedAt < createdAt || reviewedAt > updatedAt)) ||
    ['approved', 'rejected', 'revoked'].includes(current) !==
      (reviewedAt !== null) ||
    (['awaiting-review', 'approved', 'revoked'].includes(current) &&
      verifiedAt === null) ||
    (current === 'awaiting-proof' && verifiedAt !== null) ||
    typeof value['applicationSlug'] !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value['applicationSlug']) ||
    value['applicationSlug'].length > 80
  )
    throw new OwnershipInputError('Invalid ownership proof or lifecycle');
  return {
    ...parseOwnershipClaimInput({
      applicationId: value['applicationId'],
      evidenceUrl: value['evidenceUrl'],
      notes: value['notes'],
    }),
    id: ownershipId(value['id']),
    claimantIdentityId: ownershipIdentity(value['claimantIdentityId']),
    revision: ownershipRevision(value['revision']),
    applicationRevision: ownershipRevision(value['applicationRevision']),
    applicationName: text(value['applicationName'], 2, 100),
    applicationSlug: value['applicationSlug'],
    website,
    hostname,
    challengeName: value['challengeName'],
    challengeValue: value['challengeValue'],
    status: current,
    createdAt,
    updatedAt,
    expiresAt,
    verifiedAt,
    reviewedAt,
    reason: text(
      value['reason'],
      ['rejected', 'revoked'].includes(current) ? 1 : 0,
      1000,
      true
    ),
  };
}
/** Authorization precedes this domain decision; SQL repeats these invariants against locked current state. */
export function assertOwnershipTransition(
  action: Exclude<OwnershipAction, 'create'>,
  claim: OwnershipClaim,
  input: OwnershipChangeInput,
  at: number,
  applicationRevision: number
) {
  ownershipTime(at);
  if (at < claim.updatedAt)
    throw new OwnershipConflictError(
      'The ownership clock moved backwards. Try again shortly.'
    );
  if (
    claim.revision !== input.expectedRevision ||
    !Number.isSafeInteger(claim.revision + 1)
  )
    throw new OwnershipConflictError(
      'The ownership claim changed. Reload before continuing.'
    );
  const pending =
    claim.status === 'awaiting-proof' || claim.status === 'awaiting-review';
  if (
    (['verify', 'approve', 'reject', 'cancel'].includes(action) && !pending) ||
    (['release', 'revoke'].includes(action) && claim.status !== 'approved')
  )
    throw new OwnershipConflictError(
      'This ownership claim no longer allows that action'
    );
  if (action === 'verify' || action === 'approve') {
    if (at >= claim.expiresAt)
      throw new OwnershipConflictError(
        'The ownership challenge expired. Cancel it and create a new claim.'
      );
    if (applicationRevision !== claim.applicationRevision)
      throw new OwnershipConflictError(
        'The application changed after this claim. Cancel it and create a new claim.'
      );
  }
  if (
    action === 'approve' &&
    (claim.status !== 'awaiting-review' ||
      claim.verifiedAt === null ||
      at - claim.verifiedAt > OWNERSHIP_PROOF_FRESHNESS)
  )
    throw new OwnershipConflictError(
      'Fresh domain proof is required before ownership approval'
    );
  if (['reject', 'revoke'].includes(action) && !input.reason.trim())
    throw new OwnershipInputError(
      'A reason is required for this ownership decision'
    );
}
export function parseOwnershipReceipt(input: unknown): OwnershipReceipt {
  const value = ownershipObject(input, [
    'id',
    'revision',
    'action',
    'status',
    'proofMatched',
    'applicationRevision',
  ]);
  const action = value['action'];
  if (
    action !== 'create' &&
    action !== 'verify' &&
    action !== 'approve' &&
    action !== 'reject' &&
    action !== 'cancel' &&
    action !== 'release' &&
    action !== 'revoke'
  )
    throw new OwnershipInputError('Invalid ownership receipt action');
  const current = status(value['status']);
  const proofMatched = value['proofMatched'];
  if (proofMatched !== null && typeof proofMatched !== 'boolean')
    throw new OwnershipInputError('Invalid ownership verification result');
  if (
    action === 'verify'
      ? typeof proofMatched !== 'boolean'
      : proofMatched !== null
  )
    throw new OwnershipInputError('Invalid ownership verification result');
  const revision = ownershipRevision(value['revision']);
  const applicationRevision =
    value['applicationRevision'] === null
      ? null
      : ownershipRevision(value['applicationRevision']);
  const expected =
    action === 'create'
      ? 'awaiting-proof'
      : action === 'verify'
      ? proofMatched
        ? 'awaiting-review'
        : 'awaiting-proof'
      : action === 'approve'
      ? 'approved'
      : action === 'reject'
      ? 'rejected'
      : action === 'cancel'
      ? 'cancelled'
      : 'revoked';
  if (
    current !== expected ||
    (action === 'create' ? revision !== 1 : revision < 2) ||
    ['approve', 'revoke', 'release'].includes(action) !==
      (applicationRevision !== null)
  )
    throw new OwnershipInputError('Invalid ownership receipt lifecycle');
  return {
    id: ownershipId(value['id']),
    revision,
    action,
    status: current,
    proofMatched,
    applicationRevision,
  };
}
export function parseOwnershipPage(input: unknown): OwnershipPage {
  const value = ownershipObject(input, ['items', 'page', 'total']);
  if (
    !Array.isArray(value['items']) ||
    value['items'].length > 20 ||
    typeof value['total'] !== 'number' ||
    !Number.isSafeInteger(value['total']) ||
    value['total'] < 0
  )
    throw new OwnershipInputError('Invalid ownership page');
  const page = ownershipRevision(value['page']);
  const items = value['items'].map(parseOwnershipClaim);
  if (
    page > 10000 ||
    items.length > value['total'] ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new OwnershipInputError('Invalid ownership page');
  return { items, page, total: value['total'] };
}
