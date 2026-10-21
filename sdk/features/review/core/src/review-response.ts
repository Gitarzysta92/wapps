import {
  reviewBoolean,
  reviewBindingKey,
  reviewContent,
  reviewCursor,
  reviewId,
  reviewObject,
  reviewRevision,
  reviewSummary,
  reviewText,
  ReviewInputError,
  type MemberReview,
  type ReviewPage,
  type ReviewReport,
  type ReviewReportPage,
} from './review';

export function memberReview(input: unknown, bindingKey: string): MemberReview {
  const row = reviewObject(input, [
    'id',
    'bindingKey',
    'revision',
    'contentRevision',
    'content',
    'withdrawn',
    'hidden',
    'moderationReason',
    'createdAt',
    'updatedAt',
    'helpfulCount',
    'helpful',
    'reported',
    'mine',
    'canModerate',
    'openReports',
  ]);
  const value: MemberReview = {
    id: reviewId(row['id']),
    bindingKey: reviewBindingKey(row['bindingKey']),
    revision: reviewRevision(row['revision']),
    contentRevision: reviewRevision(row['contentRevision']),
    content: reviewContent(row['content']),
    withdrawn: reviewBoolean(row['withdrawn']),
    hidden: reviewBoolean(row['hidden']),
    moderationReason:
      row['moderationReason'] === null
        ? null
        : reviewText(row['moderationReason'], 'Moderation reason', 1000),
    createdAt: reviewRevision(row['createdAt']),
    updatedAt: reviewRevision(row['updatedAt']),
    helpfulCount: reviewRevision(row['helpfulCount'], 0),
    helpful: reviewBoolean(row['helpful']),
    reported: reviewBoolean(row['reported']),
    mine: reviewBoolean(row['mine']),
    canModerate: reviewBoolean(row['canModerate']),
    openReports:
      row['openReports'] === null
        ? null
        : reviewRevision(row['openReports'], 0),
  };
  if (
    value.bindingKey !== reviewBindingKey(bindingKey) ||
    value.contentRevision > value.revision ||
    value.updatedAt < value.createdAt ||
    (value.helpful && value.helpfulCount === 0) ||
    (value.mine && (value.helpful || value.reported || value.canModerate))
  )
    throw new ReviewInputError('Inconsistent review response');
  return value;
}

function pageRows(input: unknown): { rows: unknown[]; next: string | null } {
  const row = reviewObject(input, ['items', 'next']);
  if (
    !Array.isArray(row['items']) ||
    row['items'].length > 10 ||
    (row['next'] !== null && typeof row['next'] !== 'string')
  )
    throw new ReviewInputError('Invalid review page');
  const next = row['next'];
  reviewCursor(next);
  if (next !== null && row['items'].length !== 10)
    throw new ReviewInputError('Invalid review continuation');
  return { rows: row['items'], next };
}

export function reviewPage(
  input: unknown,
  bindingKey: string,
  moderation = false
): ReviewPage {
  bindingKey = reviewBindingKey(bindingKey);
  const row = reviewObject(input, [
    'items',
    'next',
    'summary',
    'mine',
    'canModerate',
  ]);
  const { rows, next } = pageRows({ items: row['items'], next: row['next'] });
  const items = rows.map((value) => memberReview(value, bindingKey));
  const mine =
    row['mine'] === null ? null : memberReview(row['mine'], bindingKey);
  const summary = reviewSummary(row['summary']);
  const canModerate = reviewBoolean(row['canModerate']);
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    (mine && !mine.mine) ||
    (moderation && !canModerate) ||
    (!moderation &&
      (items.some((item) => item.hidden || item.withdrawn) ||
        summary.total < items.length))
  )
    throw new ReviewInputError('Inconsistent review listing');
  return { items, next, mine, summary, canModerate };
}

export function reviewReportPage(input: unknown): ReviewReportPage {
  const { rows, next } = pageRows(input);
  const items = rows.map((value): ReviewReport => {
    const row = reviewObject(value, [
      'id',
      'reason',
      'content',
      'contentRevision',
      'createdAt',
      'resolution',
    ]);
    const resolution = row['resolution'];
    if (
      resolution !== 'open' &&
      resolution !== 'dismissed' &&
      resolution !== 'hidden'
    )
      throw new ReviewInputError('Invalid report resolution');
    return {
      id: reviewId(row['id']),
      reason: reviewText(row['reason'], 'Report reason', 1000),
      content: reviewContent(row['content']),
      contentRevision: reviewRevision(row['contentRevision']),
      createdAt: reviewRevision(row['createdAt']),
      resolution,
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new ReviewInputError('Duplicate reports');
  return { items, next };
}
