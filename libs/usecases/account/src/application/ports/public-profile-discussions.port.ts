import type { ProfileDiscussionsPage } from '@domains/community';

export interface PublicProfileDiscussionsPort {
  read(
    ownerIdentityId: string,
    after: string | null
  ): Promise<ProfileDiscussionsPage>;
}
