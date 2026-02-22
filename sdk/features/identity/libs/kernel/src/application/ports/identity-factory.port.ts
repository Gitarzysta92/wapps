import { Result } from '@sdk/kernel/standard';
import { Identity } from '../../domain/identity';
import { IdentityCreationDto } from '../models/identity-creation.dto';

export interface IIdentityFactory {
  create(args: IdentityCreationDto): Promise<Result<Identity, Error>>;
}
