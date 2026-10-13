import type {
  ProfileAvatarChange,
  ProfileUpdateReceipt,
} from '@domains/customer/profiles';

export interface ProfileAvatarImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface ProfileAvatarStore {
  inspect(
    uid: string,
    change: ProfileAvatarChange,
    key: string
  ): Promise<ProfileUpdateReceipt | null>;
  change(
    uid: string,
    change: ProfileAvatarChange,
    key: string,
    image: ProfileAvatarImage | null
  ): Promise<ProfileUpdateReceipt>;
  read(uid: string, id: string): Promise<ProfileAvatarImage>;
}

export interface ProfileAvatarNormalizer {
  normalize(
    bytes: Uint8Array,
    source: NonNullable<ProfileAvatarChange['source']>
  ): Promise<ProfileAvatarImage>;
}
