import type {
  PrivateProfile,
  ProfileUpdate,
  ProfileUpdateReceipt,
} from '@domains/customer/profiles';

export interface PrivateProfileStore {
  getProfile(uid: string): Promise<PrivateProfile>;
  updateProfile(
    uid: string,
    input: ProfileUpdate,
    key: string
  ): Promise<ProfileUpdateReceipt>;
}
