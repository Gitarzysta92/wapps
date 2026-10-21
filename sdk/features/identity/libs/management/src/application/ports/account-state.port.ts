export interface AccountProfile {
  name: string | null;
  bio: string | null;
  location: string | null;
  avatarUri: string | null;
}

export interface AccountState {
  identityId: string;
  subjectId: string;
  revision: number;
  status: 'STUB' | 'ACTIVE';
  createdAt: number;
  updatedAt: number;
  registeredAt: number | null;
  profile: AccountProfile;
}

export interface AccountRegistration {
  name: string;
  bio: string | null;
  location: string | null;
  avatarUri: string | null;
  expectedRevision: number;
}

export interface AccountRegistrationReceipt {
  identityId: string;
  revision: number;
  registered: true;
}

export interface AccountStateStore {
  account(uid: string): Promise<AccountState>;
  completeRegistration(
    uid: string,
    input: AccountRegistration,
    key: string
  ): Promise<AccountRegistrationReceipt>;
}
