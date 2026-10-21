import { ProfileContractError } from './private-profile';

export const PROFILE_AVATAR_SOURCE_LIMIT = 2 * 1024 * 1024;
export const PROFILE_AVATAR_OUTPUT_LIMIT = 256 * 1024;
export const PROFILE_AVATAR_DIMENSION = 512;
export const PROFILE_AVATAR_PIXEL_LIMIT = 16_000_000;
export type ProfileAvatarSourceType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ProfileAvatarChange {
  expectedRevision: number;
  source: {
    contentType: ProfileAvatarSourceType;
    bytes: number;
    sha256: string;
  } | null;
}

export function isProfileAvatarId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)
  );
}

export function parseProfileAvatarChange(input: unknown): ProfileAvatarChange {
  const fail = (): never => {
    throw new ProfileContractError('Invalid photo change');
  };
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return fail();
  const value = input as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !['expectedRevision', 'source'].includes(key)
    ) ||
    typeof value['expectedRevision'] !== 'number' ||
    !Number.isSafeInteger(value['expectedRevision']) ||
    value['expectedRevision'] < 1
  )
    return fail();
  if (value['source'] === null)
    return { expectedRevision: value['expectedRevision'], source: null };
  if (
    !value['source'] ||
    typeof value['source'] !== 'object' ||
    Array.isArray(value['source'])
  )
    return fail();
  const source = value['source'] as Record<string, unknown>;
  if (
    Object.keys(source).some(
      (key) => !['contentType', 'bytes', 'sha256'].includes(key)
    ) ||
    typeof source['contentType'] !== 'string' ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(
      source['contentType']
    ) ||
    typeof source['bytes'] !== 'number' ||
    !Number.isSafeInteger(source['bytes']) ||
    source['bytes'] < 1 ||
    source['bytes'] > PROFILE_AVATAR_SOURCE_LIMIT ||
    typeof source['sha256'] !== 'string' ||
    !/^[0-9a-f]{64}$/.test(source['sha256'])
  )
    return fail();
  return {
    expectedRevision: value['expectedRevision'],
    source: {
      contentType: source['contentType'] as ProfileAvatarSourceType,
      bytes: source['bytes'],
      sha256: source['sha256'],
    },
  };
}
