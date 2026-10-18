import type { SavedFavorite } from '@domains/customer/favorites';
import type {
  ProfileActivityBatch,
  ProfileActivityPosition,
  ProfileActivitySharing,
} from '@domains/customer/profiles';
import type { PublicProfileSnapshot } from './public-profile.port';
import type { PublicProfileContentOwnerStore } from './public-profile-suites.port';

export interface PublicProfileActivityStore
  extends PublicProfileContentOwnerStore {
  activityFavorites(
    snapshot: PublicProfileSnapshot,
    viewer: string | null
  ): Promise<SavedFavorite[]>;
}
export interface PublicProfileActivitySource {
  read(
    ownerIdentityId: string,
    after: ProfileActivityPosition | null,
    sharing: ProfileActivitySharing
  ): Promise<ProfileActivityBatch>;
}
export interface ProfileActivityCursors {
  open(token: string, profileId: string): ProfileActivityPosition;
  seal(position: ProfileActivityPosition, profileId: string): string;
}
