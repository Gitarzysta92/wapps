import type { ProfileDiscussionsPage } from '@domains/discussion/contracts';

export interface PublicProfileDiscussionsPort {
  read(
    ownerIdentityId: string,
    after: string | null
  ): Promise<ProfileDiscussionsPage>;
}
