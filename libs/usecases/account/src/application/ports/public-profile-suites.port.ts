import type { ProfileSuitesPage } from '@domains/publication/suite';
import type { PublicProfileSnapshot } from './public-profile.port';

export interface PublicProfileContentOwnerStore {
  contentOwner(
    snapshot: PublicProfileSnapshot,
    viewer: string | null
  ): Promise<string>;
}
export interface PublicProfileSuitesPort {
  read(
    ownerIdentityId: string,
    after: string | null
  ): Promise<ProfileSuitesPage>;
}
