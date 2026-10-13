import type { ProfileArticlesPage } from '@domains/publication/article';

export interface PublicProfileArticlesPort {
  read(
    ownerIdentityId: string,
    after: string | null
  ): Promise<ProfileArticlesPage>;
}
