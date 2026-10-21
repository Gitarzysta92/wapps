import { parsePrivateProfile } from '@domains/customer/profiles';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';

function record(input: unknown, fields: readonly string[]) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.includes(key))
  )
    throw new Error('Invalid account contract');
  return input as Record<string, unknown>;
}

function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error('Invalid account revision or timestamp');
  return value;
}

export function parsePortalAccount(input: unknown) {
  const value = record(input, [
    'uid',
    'identityId',
    'subjectId',
    'revision',
    'account',
    'profile',
  ]);
  const account = record(value['account'], [
    'status',
    'createdAt',
    'updatedAt',
    'registeredAt',
    'email',
  ]);
  const profile = record(value['profile'], [
    'name',
    'bio',
    'location',
    'avatar',
  ]);
  if (
    !isCanonicalIdentityId(value['uid']) ||
    value['uid'] !== value['identityId'] ||
    typeof value['subjectId'] !== 'string' ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value['subjectId']) ||
    (account['status'] !== 'ACTIVE' && account['status'] !== 'STUB') ||
    (account['email'] !== undefined &&
      (typeof account['email'] !== 'string' ||
        !account['email'] ||
        account['email'].length > 320 ||
        Array.from(account['email']).some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        )))
  )
    throw new Error('Invalid account identity');
  const avatar =
    profile['avatar'] === null
      ? null
      : record(profile['avatar'], ['uri', 'alt']);
  if (
    avatar &&
    (typeof avatar['alt'] !== 'string' ||
      avatar['alt'] !== (profile['name'] ?? ''))
  )
    throw new Error('Invalid account avatar');
  const parsed = parsePrivateProfile({
    identityId: value['identityId'],
    revision: value['revision'],
    registeredAt: account['registeredAt'],
    updatedAt: account['updatedAt'],
    profile: {
      name: profile['name'],
      bio: profile['bio'],
      location: profile['location'],
      avatarUri: avatar ? avatar['uri'] : null,
      socialLinks: {},
    },
  });
  const createdAt = positive(account['createdAt']);
  if (
    createdAt > parsed.updatedAt ||
    (parsed.registeredAt !== null && parsed.registeredAt < createdAt) ||
    (account['status'] === 'STUB') !== (parsed.registeredAt === null)
  )
    throw new Error('Invalid account lifecycle');
  return {
    uid: value['uid'],
    identityId: parsed.identityId,
    subjectId: value['subjectId'],
    revision: parsed.revision,
    account: {
      status: account['status'] as 'ACTIVE' | 'STUB',
      createdAt,
      updatedAt: parsed.updatedAt,
      registeredAt: parsed.registeredAt,
      ...(account['email'] === undefined
        ? {}
        : { email: account['email'] as string }),
    },
    profile: {
      name: parsed.profile.name,
      bio: parsed.profile.bio,
      location: parsed.profile.location,
      avatar: avatar
        ? { uri: parsed.profile.avatarUri, alt: avatar['alt'] as string }
        : null,
    },
  };
}

export function parsePortalErasureReceipt(input: unknown) {
  const value = record(input, ['identityId', 'revision', 'status', 'cleanup']);
  if (
    !isCanonicalIdentityId(value['identityId']) ||
    value['status'] !== 'accepted' ||
    (value['cleanup'] !== 'pending' &&
      value['cleanup'] !== 'completed' &&
      value['cleanup'] !== 'failed')
  )
    throw new Error('Invalid erasure receipt');
  return {
    identityId: value['identityId'],
    revision: positive(value['revision']),
    status: 'accepted' as const,
    cleanup: value['cleanup'] as 'pending' | 'completed' | 'failed',
  };
}
