import type {
  ProfileBadgeAdministration,
  ProfileBadgeChange,
  ProfileBadgeEvent,
  SharedProfileBadges,
} from '@domains/customer/profiles';
import type { PublicProfileSnapshot } from './public-profile.port';

export interface ProfileBadgesStore {
  assertStaffIdentity(uid: string): Promise<void>;
  administer(
    uid: string,
    profileId: string,
    after: number | null
  ): Promise<ProfileBadgeAdministration>;
  change(
    uid: string,
    profileId: string,
    command: ProfileBadgeChange,
    key: string
  ): Promise<ProfileBadgeEvent>;
  own(uid: string): Promise<SharedProfileBadges>;
  shared(
    snapshot: PublicProfileSnapshot,
    viewer: string | null
  ): Promise<SharedProfileBadges>;
}
