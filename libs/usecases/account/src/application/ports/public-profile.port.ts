import type {
  ProfileFollow,
  ProfileFollowAction,
  ProfileFollowChange,
  ProfileFollowerList,
  ProfileFollowingList,
  ProfileVisibility,
  PublicProfile,
} from '@domains/customer/profiles';
import type { Result } from '@sdk/kernel/standard';
import type { ProfileAvatarImage } from './profile-avatar.port';

/** Every fact comes from one canonical SQL snapshot, never ingress roles or a projection. */
export interface ProfileAudienceFacts {
  ownerId: string;
  viewerId: string | null;
  visibility: ProfileVisibility;
  ownerActive: boolean;
  viewerActive: boolean;
  viewerRegistered: boolean;
  approved: boolean;
  favoritesShared?: boolean;
  suitesShared?: boolean;
  discussionsShared?: boolean;
  activityShared?: boolean;
  badgesShared?: boolean;
}

export interface PublicProfileSnapshot {
  profile: PublicProfile;
  facts: ProfileAudienceFacts;
  follow: ProfileFollow | null;
  stamp: string;
}

export interface ProfileFollowSnapshot {
  facts: ProfileAudienceFacts;
  follow: ProfileFollow;
  stamp: string;
}

export interface ProfileAudiencePolicy {
  evaluate(
    action:
      | 'read'
      | 'read-favorites'
      | 'read-suites'
      | 'read-discussions'
      | 'read-activity'
      | 'read-badges'
      | 'discover'
      | 'request-access'
      | ProfileFollowAction,
    facts: ProfileAudienceFacts,
    requesterId?: string
  ): Promise<Result<boolean, Error>>;
}

export interface PublicProfileStore {
  inspect(
    id: string,
    viewer: string | null
  ): Promise<PublicProfileSnapshot | null>;
  confirm(
    snapshot: PublicProfileSnapshot,
    viewer: string | null
  ): Promise<PublicProfileSnapshot | null>;
  avatar(
    snapshot: PublicProfileSnapshot,
    viewer: string | null,
    id: string
  ): Promise<ProfileAvatarImage>;
  directory(
    after: string | null,
    viewer: string | null
  ): Promise<{ snapshots: PublicProfileSnapshot[]; after: string | null }>;
  followers(uid: string, after: string | null): Promise<ProfileFollowerList>;
  following(uid: string, after: string | null): Promise<ProfileFollowingList>;
  prepareFollow(
    uid: string,
    input: ProfileFollowChange,
    key: string
  ): Promise<
    | { receipt: ProfileFollow; snapshot?: never }
    | { receipt?: never; snapshot: ProfileFollowSnapshot }
  >;
  changeFollow(
    uid: string,
    input: ProfileFollowChange,
    key: string,
    snapshot: ProfileFollowSnapshot,
    next: ProfileFollow
  ): Promise<ProfileFollow>;
}

export class PublicProfileNotFound extends Error {
  constructor() {
    super('Profile unavailable');
  }
}
