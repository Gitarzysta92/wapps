import type { ProfileSocialLinksDto } from './profile.dto';
import { isProfileAvatarId } from './profile-avatar';

export interface PrivateProfile {
  identityId: string;
  publicId?: string;
  revision: number;
  registeredAt: number | null;
  updatedAt: number;
  profile: {
    name: string | null;
    bio: string | null;
    location: string | null;
    contactEmail?: string | null;
    avatarUri: string | null;
    avatarId?: string | null;
    socialLinks: ProfileSocialLinksDto;
  };
}

/** Replaces editable text fields; media is managed by its own lifecycle. */
export interface ProfileUpdate {
  expectedRevision: number;
  name: string;
  bio: string | null;
  location: string | null;
  socialLinks: ProfileSocialLinksDto;
  /** Omission preserves a saved contact address for older clients and receipts. */
  contactEmail?: string | null;
}

export interface ProfileUpdateReceipt {
  identityId: string;
  revision: number;
}

export class ProfileContractError extends Error {}

/** One plain ASCII mailbox, without display names, address lists or mail headers. */
export function parseProfileContactEmail(input: unknown): string | null {
  if (input === null) return null;
  if (typeof input !== 'string' || input.length > 254)
    throw new ProfileContractError(
      'Enter a contact email of at most 254 characters.'
    );
  // Controls must be rejected before trimming, including pasted CR/LF headers.
  if (
    Array.from(input).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) > 126
    )
  )
    throw new ProfileContractError('Enter one plain contact email address.');
  const value = input.trim();
  if (!value) return null;
  const parts = value.split('@');
  const [local, domain] = parts;
  if (
    parts.length !== 2 ||
    local.length > 64 ||
    !/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(
      local
    ) ||
    !domain.includes('.') ||
    domain.length > 253 ||
    !domain
      .split('.')
      .every((label) =>
        /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)
      )
  )
    throw new ProfileContractError(
      'Enter one plain contact email address, such as hello@example.com.'
    );
  return `${local}@${domain.toLowerCase()}`;
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ProfileContractError(message);
}

function object(
  input: unknown,
  fields: readonly string[]
): Record<string, unknown> {
  requireValue(
    input !== null && typeof input === 'object' && !Array.isArray(input),
    'Expected profile object'
  );
  requireValue(
    Object.keys(input).every((key) => fields.includes(key)),
    'Unknown profile field'
  );
  return input as Record<string, unknown>;
}

function hasControls(input: string, multiline = false): boolean {
  return Array.from(input).some((character) => {
    const code = character.charCodeAt(0);
    return (
      code === 127 || (code < 32 && !(multiline && [9, 10, 13].includes(code)))
    );
  });
}

function text(
  input: unknown,
  max: number,
  nullable = true,
  multiline = false
): string | null {
  if (nullable && input === null) return null;
  requireValue(
    typeof input === 'string' && input.length <= max,
    `Expected text of at most ${max} characters`
  );
  requireValue(!hasControls(input, multiline), 'Invalid control characters');
  const result = input.trim();
  requireValue(nullable || result.length > 0, 'Display name is required');
  return result || null;
}

function positiveInteger(input: unknown): number {
  requireValue(
    typeof input === 'number' && Number.isSafeInteger(input) && input > 0,
    'Invalid profile revision or timestamp'
  );
  return input;
}

function identityId(input: unknown): string {
  requireValue(
    typeof input === 'string' &&
      input.length > 0 &&
      input.length <= 128 &&
      input === input.trim() &&
      !hasControls(input),
    'Invalid profile identity'
  );
  return input;
}

function webUrl(input: string): string {
  try {
    const url = new URL(input);
    requireValue(
      /^https?:\/\//i.test(input) &&
        ['http:', 'https:'].includes(url.protocol) &&
        !!url.hostname &&
        !url.username &&
        !url.password &&
        !/\s/.test(input),
      'Expected an absolute http or https URL without credentials'
    );
    return input;
  } catch {
    throw new ProfileContractError(
      'Expected an absolute http or https URL without credentials'
    );
  }
}

export function parseProfileSocialLinks(input: unknown): ProfileSocialLinksDto {
  const keys = [
    'facebook',
    'twitter',
    'linkedin',
    'github',
    'medium',
    'website',
  ] as const;
  const source = object(input, keys);
  const result: ProfileSocialLinksDto = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = text(source[key], 2048);
    if (value === null) continue;
    if (key === 'twitter' && /^@?[a-zA-Z0-9_]{1,15}$/.test(value))
      result[key] = value;
    else if (
      key === 'github' &&
      /^@?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value)
    )
      result[key] = value;
    else result[key] = webUrl(value);
  }
  return result;
}

export function parseProfileUpdate(input: unknown): ProfileUpdate {
  const source = object(input, [
    'expectedRevision',
    'name',
    'bio',
    'location',
    'socialLinks',
    'contactEmail',
  ]);
  const name = text(source['name'], 120, false);
  requireValue(name !== null, 'Display name is required');
  return {
    expectedRevision: positiveInteger(source['expectedRevision']),
    name,
    bio: text(source['bio'], 500, true, true),
    location: text(source['location'], 120),
    socialLinks: parseProfileSocialLinks(source['socialLinks']),
    ...(source['contactEmail'] !== undefined
      ? { contactEmail: parseProfileContactEmail(source['contactEmail']) }
      : {}),
  };
}

export function parseProfileUpdateReceipt(
  input: unknown
): ProfileUpdateReceipt {
  const source = object(input, ['identityId', 'revision']);
  return {
    identityId: identityId(source['identityId']),
    revision: positiveInteger(source['revision']),
  };
}

export function parsePrivateProfile(input: unknown): PrivateProfile {
  const source = object(input, [
    'identityId',
    'publicId',
    'revision',
    'registeredAt',
    'updatedAt',
    'profile',
  ]);
  const profile = object(source['profile'], [
    'name',
    'bio',
    'location',
    'avatarUri',
    'avatarId',
    'socialLinks',
    'contactEmail',
  ]);
  requireValue(
    source['publicId'] === undefined || isProfileAvatarId(source['publicId']),
    'Invalid public profile ID'
  );
  const registeredAt =
    source['registeredAt'] === null
      ? null
      : positiveInteger(source['registeredAt']);
  const updatedAt = positiveInteger(source['updatedAt']);
  requireValue(
    updatedAt <= 8_640_000_000_000_000 &&
      (registeredAt === null || registeredAt <= updatedAt),
    'Invalid profile timestamps'
  );
  const avatarUri = text(profile['avatarUri'], 2048);
  const avatarId = profile['avatarId'] ?? null;
  requireValue(
    avatarId === null || isProfileAvatarId(avatarId),
    'Invalid profile photo reference'
  );
  requireValue(
    avatarId === null || (avatarUri === null && registeredAt !== null),
    'Invalid profile photo association'
  );
  const name = text(profile['name'], 120, registeredAt === null);
  const bio = text(profile['bio'], 500, true, true);
  const location = text(profile['location'], 120);
  const socialLinks = parseProfileSocialLinks(profile['socialLinks']);
  const contactEmail = Object.prototype.hasOwnProperty.call(
    profile,
    'contactEmail'
  )
    ? parseProfileContactEmail(profile['contactEmail'])
    : null;
  requireValue(
    registeredAt !== null ||
      (name === null &&
        bio === null &&
        location === null &&
        contactEmail === null &&
        avatarUri === null &&
        Object.keys(socialLinks).length === 0),
    'Unregistered profile contains registered fields'
  );
  return {
    identityId: identityId(source['identityId']),
    ...(source['publicId'] === undefined
      ? {}
      : { publicId: source['publicId'] as string }),
    revision: positiveInteger(source['revision']),
    registeredAt,
    updatedAt,
    profile: {
      name,
      bio,
      location,
      avatarUri: avatarUri === null ? null : webUrl(avatarUri),
      ...(Object.prototype.hasOwnProperty.call(profile, 'avatarId')
        ? { avatarId }
        : {}),
      socialLinks,
      ...(Object.prototype.hasOwnProperty.call(profile, 'contactEmail')
        ? { contactEmail }
        : {}),
    },
  };
}
