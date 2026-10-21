import {
  parseProfileSocialLinks,
  ProfileContractError,
} from './private-profile';
import type { ProfileSocialLinksDto } from './profile.dto';
import { parseProfileContactEmail } from './private-profile';

export interface PublicProfile {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  socialLinks: ProfileSocialLinksDto;
  avatarId: string | null;
  registeredAt: number;
  contactEmail?: string | null;
}

export type ProfileVisibility = 'public' | 'private' | 'followers';
export type ProfileFollowStatus = 'none' | 'pending' | 'approved';
export type ProfileFollowAction = 'request' | 'cancel' | 'approve' | 'remove';

export interface ProfileFollow {
  ownerId: string;
  requesterId: string;
  revision: number;
  status: ProfileFollowStatus;
}

export interface ProfileFollowChange {
  ownerId: string;
  requesterId: string;
  expectedRevision: number;
  action: ProfileFollowAction;
}

export interface PublicProfileView {
  access: 'visible' | 'followers';
  profile: PublicProfile | null;
  isOwner: boolean;
  follow: ProfileFollow | null;
}

export interface ProfileDirectory {
  profiles: PublicProfile[];
  after: string | null;
}

export interface ProfileFollowerList {
  followers: (ProfileFollow & { requesterName: string })[];
  after: string | null;
}
export interface ProfileFollowingList {
  following: ProfileFollow[];
  after: string | null;
}

export const PROFILE_DIRECTORY_PAGE_SIZE = 20;
export const PROFILE_FOLLOW_PAGE_SIZE = 20;
export const PROFILE_FOLLOW_OUTGOING_LIMIT = 200;
export const PROFILE_FOLLOW_PENDING_LIMIT = 200;
export const PROFILE_FOLLOW_APPROVED_LIMIT = 1000;
export const PROFILE_FOLLOW_DAILY_REQUEST_LIMIT = 20;

export function isPublicProfileId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)
  );
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ProfileContractError(message);
}

function object(
  input: unknown,
  keys: string[],
  optional: string[] = []
): Record<string, unknown> {
  requireValue(
    input !== null && typeof input === 'object' && !Array.isArray(input),
    'Expected profile object'
  );
  requireValue(
    keys.every((key) => Object.prototype.hasOwnProperty.call(input, key)) &&
      Object.keys(input).every(
        (key) => keys.includes(key) || optional.includes(key)
      ),
    'Missing or unknown profile field'
  );
  return input as Record<string, unknown>;
}

function revision(input: unknown): number {
  requireValue(
    typeof input === 'number' && Number.isSafeInteger(input) && input >= 0,
    'Invalid follow revision'
  );
  return input;
}

export function parsePublicProfile(input: unknown): PublicProfile {
  const value = object(
    input,
    [
      'id',
      'name',
      'bio',
      'location',
      'socialLinks',
      'avatarId',
      'registeredAt',
    ],
    ['contactEmail']
  );
  requireValue(isPublicProfileId(value['id']), 'Invalid public profile ID');
  requireValue(
    value['avatarId'] === null || isPublicProfileId(value['avatarId']),
    'Invalid public photo ID'
  );
  for (const [key, limit] of [
    ['name', 120],
    ['bio', 500],
    ['location', 120],
  ] as const) {
    const text = value[key];
    requireValue(
      (key !== 'name' && text === null) ||
        (typeof text === 'string' &&
          text.length > 0 &&
          text.length <= limit &&
          text.trim() === text &&
          !Array.from(text).some(
            (c) =>
              c.charCodeAt(0) === 127 ||
              (c.charCodeAt(0) < 32 &&
                !(key === 'bio' && [9, 10, 13].includes(c.charCodeAt(0))))
          )),
      'Invalid public profile text'
    );
  }
  const registeredAt = revision(value['registeredAt']);
  requireValue(
    registeredAt > 0 && registeredAt <= 8_640_000_000_000_000,
    'Invalid registration date'
  );
  return {
    id: value['id'],
    name: value['name'] as string,
    bio: value['bio'] as string | null,
    location: value['location'] as string | null,
    avatarId: value['avatarId'] as string | null,
    socialLinks: parseProfileSocialLinks(value['socialLinks']),
    registeredAt,
    ...(Object.prototype.hasOwnProperty.call(value, 'contactEmail')
      ? { contactEmail: parseProfileContactEmail(value['contactEmail']) }
      : {}),
  };
}

export function parseProfileFollow(input: unknown): ProfileFollow {
  const value = object(input, ['ownerId', 'requesterId', 'revision', 'status']);
  requireValue(
    isPublicProfileId(value['ownerId']) &&
      isPublicProfileId(value['requesterId']) &&
      value['ownerId'] !== value['requesterId'],
    'Invalid follower pair'
  );
  requireValue(
    typeof value['status'] === 'string' &&
      ['none', 'pending', 'approved'].includes(value['status']),
    'Invalid follow status'
  );
  const current = revision(value['revision']);
  requireValue(
    current > 0 || value['status'] === 'none',
    'Unversioned follower relation'
  );
  return {
    ownerId: value['ownerId'],
    requesterId: value['requesterId'],
    revision: current,
    status: value['status'] as ProfileFollowStatus,
  };
}

export function parseProfileFollowChange(input: unknown): ProfileFollowChange {
  const value = object(input, [
    'ownerId',
    'requesterId',
    'expectedRevision',
    'action',
  ]);
  requireValue(
    isPublicProfileId(value['ownerId']) &&
      isPublicProfileId(value['requesterId']) &&
      value['ownerId'] !== value['requesterId'],
    'Invalid follower pair'
  );
  requireValue(
    typeof value['action'] === 'string' &&
      ['request', 'cancel', 'approve', 'remove'].includes(value['action']),
    'Invalid follower action'
  );
  return {
    ownerId: value['ownerId'],
    requesterId: value['requesterId'],
    expectedRevision: revision(value['expectedRevision']),
    action: value['action'] as ProfileFollowAction,
  };
}

/** Called only after authorization; a new command must describe a real transition. */
export function changeProfileFollow(
  current: ProfileFollow,
  action: ProfileFollowAction
): ProfileFollow {
  const status =
    action === 'request'
      ? 'pending'
      : action === 'approve'
      ? 'approved'
      : 'none';
  requireValue(
    action === 'request'
      ? current.status === 'none'
      : action === 'approve'
      ? current.status === 'pending'
      : current.status !== 'none',
    'Follow state changed. Reload before continuing.'
  );
  requireValue(
    Number.isSafeInteger(current.revision + 1),
    'Follow revision exhausted'
  );
  return { ...current, revision: current.revision + 1, status };
}

export function parsePublicProfileView(input: unknown): PublicProfileView {
  const value = object(input, ['access', 'profile', 'isOwner', 'follow']);
  requireValue(
    value['access'] === 'visible' || value['access'] === 'followers',
    'Invalid profile access'
  );
  requireValue(
    typeof value['isOwner'] === 'boolean',
    'Invalid profile ownership'
  );
  const profile =
    value['profile'] === null ? null : parsePublicProfile(value['profile']);
  const follow =
    value['follow'] === null ? null : parseProfileFollow(value['follow']);
  requireValue(
    (value['access'] === 'visible') === (profile !== null),
    'Inconsistent profile audience'
  );
  requireValue(
    !value['isOwner'] || (profile !== null && follow === null),
    'Invalid owner preview'
  );
  requireValue(
    !profile || !follow || profile.id === follow.ownerId,
    'Mismatched follower owner'
  );
  return {
    access: value['access'],
    profile,
    isOwner: value['isOwner'],
    follow,
  };
}

export function parseProfileDirectory(input: unknown): ProfileDirectory {
  const value = object(input, ['profiles', 'after']);
  requireValue(
    Array.isArray(value['profiles']) &&
      value['profiles'].length <= PROFILE_DIRECTORY_PAGE_SIZE,
    'Invalid profile directory'
  );
  requireValue(
    value['after'] === null || isPublicProfileId(value['after']),
    'Invalid directory cursor'
  );
  const profiles = value['profiles'].map(parsePublicProfile);
  requireValue(
    new Set(profiles.map((p) => p.id)).size === profiles.length,
    'Duplicate directory profiles'
  );
  return { profiles, after: value['after'] as string | null };
}

export function parseProfileFollowerList(input: unknown): ProfileFollowerList {
  const value = object(input, ['followers', 'after']);
  requireValue(
    Array.isArray(value['followers']) &&
      value['followers'].length <= PROFILE_FOLLOW_PAGE_SIZE,
    'Invalid follower list'
  );
  requireValue(
    value['after'] === null || isPublicProfileId(value['after']),
    'Invalid follower cursor'
  );
  const followers = value['followers'].map((item) => {
    const row = object(item, [
      'ownerId',
      'requesterId',
      'revision',
      'status',
      'requesterName',
    ]);
    const { requesterName, ...follow } = row;
    requireValue(
      typeof requesterName === 'string' &&
        requesterName.trim().length > 0 &&
        requesterName.length <= 120 &&
        !Array.from(requesterName).some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        ),
      'Invalid requester name'
    );
    const parsed = parseProfileFollow(follow);
    requireValue(parsed.status !== 'none', 'Inactive follower in list');
    return { ...parsed, requesterName };
  });
  return { followers, after: value['after'] as string | null };
}

export function parseProfileFollowingList(
  input: unknown
): ProfileFollowingList {
  const value = object(input, ['following', 'after']);
  requireValue(
    Array.isArray(value['following']) &&
      value['following'].length <= PROFILE_FOLLOW_PAGE_SIZE,
    'Invalid following list'
  );
  requireValue(
    value['after'] === null || isPublicProfileId(value['after']),
    'Invalid following cursor'
  );
  const following = value['following'].map(parseProfileFollow);
  requireValue(
    following.every((follow) => follow.status !== 'none'),
    'Inactive following relation'
  );
  return { following, after: value['after'] as string | null };
}
