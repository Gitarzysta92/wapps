import { Result } from '@sdk/kernel/standard';
import { IdentityCreationDto } from '../models/identity-creation.dto';
import { AuthSessionDto } from '../models/auth-session.dto';

export interface IAuthenticationStrategy {
  execute(): Promise<Result<IdentityCreationDto & AuthSessionDto, Error>>;
}