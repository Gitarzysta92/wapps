import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import {
  isPublicProfileId,
  profileActivityCursor,
} from '@domains/customer/profiles';
import { parsePublicFavoritesCursor } from '@domains/customer/favorites';
import { profileDiscussionsCursor } from '@domains/community';
import { singleHeader } from '../identity/trusted-portal-identity';

export function profileId(value: unknown): string {
  if (!isPublicProfileId(value))
    throw new BadRequestException('Invalid profile ID');
  return value;
}

export function profileQuery(
  request: Request,
  kind:
    | 'none'
    | 'id'
    | 'favorites'
    | 'discussions'
    | 'activity'
    | 'history' = 'none'
) {
  if (
    ['GET', 'HEAD'].includes(request.method) &&
    (request.headers['transfer-encoding'] !== undefined ||
      (request.headers['content-length'] !== undefined &&
        request.headers['content-length'] !== '0'))
  )
    throw new BadRequestException('Profile reads do not accept a body');
  if (
    Object.keys(request.query).some((key) => kind === 'none' || key !== 'after')
  )
    throw new BadRequestException('Unexpected profile query');
  const value = request.query['after'];
  if (value === undefined) return null;
  try {
    if (typeof value !== 'string') throw new Error('Invalid cursor');
    if (kind === 'favorites') return parsePublicFavoritesCursor(value);
    if (kind === 'discussions') return profileDiscussionsCursor(value);
    if (kind === 'activity') return profileActivityCursor(value);
    if (kind === 'history') {
      if (
        !/^[1-9][0-9]{0,15}$/.test(value) ||
        !Number.isSafeInteger(Number(value))
      )
        throw new Error('Invalid history cursor');
      return value;
    }
    return profileId(value);
  } catch {
    throw new BadRequestException('Invalid profile cursor');
  }
}

export function profileCommand<T>(
  request: Request,
  body: unknown,
  parse: (value: unknown) => T,
  validKey = /^[\x21-\x7e]{1,128}$/
) {
  profileQuery(request);
  const key = singleHeader(request, 'idempotency-key', 128);
  if (!key || !validKey.test(key))
    throw new BadRequestException('A valid Idempotency-Key is required');
  try {
    return { key, input: parse(body) };
  } catch {
    throw new BadRequestException('Invalid profile command');
  }
}
