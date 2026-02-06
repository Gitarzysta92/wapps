import { Result } from '@foundation/standard';

export interface IIdentityGraphProvisioner {
  ensureIdentityForFirebaseUid(
    uid: string
  ): Promise<Result<{ identityId: string; subjectId: string; created: boolean }, Error>>;
  deleteIdentityForFirebaseUid(uid: string): Promise<Result<boolean, Error>>;
}

