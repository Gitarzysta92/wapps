import type {
  ProfileContentCategory,
  ProfileContentTotals,
} from '@domains/customer/profiles';

export interface ProfileTotalsSource {
  read(
    owner: string,
    categories: readonly ProfileContentCategory[]
  ): Promise<ProfileContentTotals>;
}
