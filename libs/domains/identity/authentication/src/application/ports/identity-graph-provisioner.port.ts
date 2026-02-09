import { Result } from '@foundation/standard';

export interface IIdentityGraphProvisioner {
  ensureIdentity(
    provider: string,
    externalId: string
  ): Promise<Result<{ identityId: string; subjectId: string; created: boolean }, Error>>;

  deleteIdentity(provider: string, externalId: string): Promise<Result<boolean, Error>>;
}

