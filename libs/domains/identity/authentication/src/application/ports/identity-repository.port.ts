import { Result } from '@foundation/standard';
import { Identity } from '../../core/identity';

export interface IIdentityRepository {
  deleteById(identityId: string): Promise<Result<boolean, Error>>;
  upsert(identity: Identity): Promise<Result<boolean, Error>>;
  getByClaim(claim: string): Promise<Result<Identity, Error>>;
}