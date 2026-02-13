import { Result } from '@foundation/standard';
import { Identity } from '../../domain/identity';
import { IdentityCreationDto } from '../models/identity-creation.dto';

export interface IIdentityFactory {
  create(args: IdentityCreationDto): Promise<Result<Identity, Error>>;
}
