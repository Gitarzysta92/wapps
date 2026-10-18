import type { Request } from 'express';
import {
  reviewBindingKey,
  reviewCursor,
  ReviewInputError,
} from '@sdk/features/review/core';

export function reviewQuery(request: Request, page = false) {
  const allowed = ['bindingKey', ...(page ? ['cursor'] : [])];
  if (Object.keys(request.query).some((key) => !allowed.includes(key)))
    throw new ReviewInputError('Invalid review selectors');
  if (
    ['GET', 'HEAD'].includes(request.method) &&
    (request.headers['transfer-encoding'] !== undefined ||
      (request.headers['content-length'] !== undefined &&
        request.headers['content-length'] !== '0'))
  )
    throw new ReviewInputError('Review reads do not accept a body');
  const bindingKey = reviewBindingKey(request.query.bindingKey);
  const cursor = request.query.cursor;
  if (cursor !== undefined && typeof cursor !== 'string')
    throw new ReviewInputError('Invalid review cursor');
  reviewCursor(cursor);
  return { bindingKey, cursor: cursor ?? null };
}

export function reviewCommandKey(request: Request): string {
  const key = request.headers['idempotency-key'];
  const names = request.rawHeaders.filter((_, i) => i % 2 === 0);
  if (
    names.filter((name) => name.toLowerCase() === 'idempotency-key').length !==
      1 ||
    typeof key !== 'string' ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(key)
  )
    throw new ReviewInputError('A valid Idempotency-Key is required');
  return key;
}
