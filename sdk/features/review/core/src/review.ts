export class ReviewInputError extends Error {}
export class ReviewConflictError extends Error {}
export class ReviewMissingError extends Error {}
export class ReviewDeniedError extends Error {}

export interface ReviewContent {
  displayName: string;
  rating: number;
  text: string;
}

export interface ReviewState {
  revision: number;
  contentRevision: number;
  withdrawn: boolean;
  hidden: boolean;
  moderationReason: string | null;
}

export type ReviewChange =
  | { type: 'publish'; expectedRevision: number; content: ReviewContent }
  | { type: 'withdraw'; expectedRevision: number }
  | { type: 'helpful'; expectedRevision: number; helpful: boolean }
  | { type: 'report'; expectedRevision: number; reason: string }
  | {
      type: 'moderate';
      expectedRevision: number;
      hidden: boolean;
      reason: string;
    };

export interface MemberReview extends ReviewState {
  id: string;
  applicationId: string;
  content: ReviewContent;
  createdAt: number;
  updatedAt: number;
  helpfulCount: number;
  helpful: boolean;
  reported: boolean;
  mine: boolean;
  canModerate: boolean;
  openReports: number | null;
}

export interface ReviewSummary {
  total: number;
  average: number | null;
  distribution: [number, number, number, number, number];
}

export interface ReviewPage {
  items: MemberReview[];
  next: string | null;
  summary: ReviewSummary;
  mine: MemberReview | null;
  canModerate: boolean;
}

export interface ReviewReceipt {
  id: string;
  revision: number;
}

export interface ReviewReport {
  id: string;
  reason: string;
  content: ReviewContent;
  contentRevision: number;
  createdAt: number;
  resolution: 'open' | 'dismissed' | 'hidden';
}

export interface ReviewReportPage {
  items: ReviewReport[];
  next: string | null;
}

export function reviewObject(
  value: unknown,
  keys: string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
  )
    throw new ReviewInputError('Invalid review fields');
  return value as Record<string, unknown>;
}

export function reviewText(value: unknown, label: string, max: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return (
        code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13)
      );
    })
  )
    throw new ReviewInputError(
      `${label} must contain between 1 and ${max} characters`
    );
  return value.trim();
}

export function reviewId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new ReviewInputError(
      'A canonical review or application ID is required'
    );
  return value;
}

export function reviewRevision(value: unknown, minimum = 1): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new ReviewInputError('Invalid review revision or count');
  return value;
}

export function reviewBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean')
    throw new ReviewInputError('A boolean is required');
  return value;
}

export function reviewContent(value: unknown): ReviewContent {
  const row = reviewObject(value, ['displayName', 'rating', 'text']);
  const rating = reviewRevision(row['rating']);
  if (rating > 5) throw new ReviewInputError('Choose a rating from 1 to 5');
  return {
    displayName: reviewText(row['displayName'], 'Public name', 80),
    rating,
    text: reviewText(row['text'], 'Review', 6000),
  };
}

export function reviewChange(
  type: ReviewChange['type'],
  value: unknown
): ReviewChange {
  const extra =
    type === 'publish'
      ? ['content']
      : type === 'helpful'
      ? ['helpful']
      : type === 'report'
      ? ['reason']
      : type === 'moderate'
      ? ['hidden', 'reason']
      : [];
  const row = reviewObject(value, ['expectedRevision', ...extra]);
  const expectedRevision = reviewRevision(
    row['expectedRevision'],
    type === 'publish' ? 0 : 1
  );
  switch (type) {
    case 'publish':
      return { type, expectedRevision, content: reviewContent(row['content']) };
    case 'withdraw':
      return { type, expectedRevision };
    case 'helpful':
      return { type, expectedRevision, helpful: reviewBoolean(row['helpful']) };
    case 'report':
      return {
        type,
        expectedRevision,
        reason: reviewText(row['reason'], 'Report reason', 1000),
      };
    case 'moderate':
      return {
        type,
        expectedRevision,
        hidden: reviewBoolean(row['hidden']),
        reason: reviewText(row['reason'], 'Moderation reason', 1000),
      };
  }
}

/** Authorization belongs to the use case; this transition owns review lifecycle invariants. */
export function changeReview(
  current: ReviewState | null,
  change: ReviewChange
): ReviewState {
  if ((current?.revision ?? 0) !== change.expectedRevision)
    throw new ReviewConflictError(
      'The review changed. Reload before trying again.'
    );
  if (!current && change.type !== 'publish')
    throw new ReviewMissingError('Review not found');
  const revision = (current?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision))
    throw new ReviewConflictError('Review revision limit reached');
  if (
    (change.type === 'helpful' || change.type === 'report') &&
    current &&
    !reviewVisible(current)
  )
    throw new ReviewMissingError('Review is not public');
  const next: ReviewState = current
    ? { ...current, revision }
    : {
        revision,
        contentRevision: revision,
        withdrawn: false,
        hidden: false,
        moderationReason: null,
      };
  if (change.type === 'publish') {
    next.contentRevision = revision;
    next.withdrawn = false;
  }
  if (change.type === 'withdraw') next.withdrawn = true;
  if (change.type === 'moderate') {
    next.hidden = change.hidden;
    next.moderationReason = change.reason;
  }
  return next;
}

export function reviewVisible(state: ReviewState): boolean {
  return !state.withdrawn && !state.hidden;
}

export function reviewCursor(
  value: unknown
): { at: number; id: string } | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,15}\.[0-9a-f-]{36}$/.test(value)
  )
    throw new ReviewInputError('Invalid review cursor');
  const [at, id] = value.split('.');
  return { at: reviewRevision(Number(at)), id: reviewId(id) };
}

export function reviewSummary(value: unknown): ReviewSummary {
  const row = reviewObject(value, ['total', 'average', 'distribution']);
  const total = reviewRevision(row['total'], 0);
  const bins = row['distribution'];
  if (!Array.isArray(bins) || bins.length !== 5)
    throw new ReviewInputError('Invalid rating distribution');
  const distribution = bins.map((value) =>
    reviewRevision(value, 0)
  ) as ReviewSummary['distribution'];
  if (distribution.reduce((sum, count) => sum + count, 0) !== total)
    throw new ReviewInputError('Inconsistent rating count');
  const average = total
    ? distribution.reduce((sum, count, i) => sum + count * (i + 1), 0) / total
    : null;
  if (row['average'] !== average)
    throw new ReviewInputError('Inconsistent average rating');
  return { total, average, distribution };
}
