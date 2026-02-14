import { Result } from '@foundation/standard';
import { Identity } from '../../core/identity';
import { IdentityCreationDto } from '../models/identity-creation.dto';

export interface IIdentityProvider {
  obtainIdentity(claim: string): Promise<Result<Identity, Error>>;
  createIdentity(
    identityCreationDto: IdentityCreationDto,
    extras?: { activate?: boolean }
  ): Promise<Result<Identity, Error>>;
}
