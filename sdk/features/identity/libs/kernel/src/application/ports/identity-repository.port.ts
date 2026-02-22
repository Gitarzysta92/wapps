import { Result } from '@sdk/kernel/standard';
import { Identity } from '../../domain/identity';

export interface IIdentityRepository {
  deleteById(identityId: string): Promise<Result<boolean, Error>>;
  upsert(identity: Identity): Promise<Result<boolean, Error>>;
  getByClaim(claim: string): Promise<Result<Identity, Error>>;
}
