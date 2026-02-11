import { Result } from '@foundation/standard';
import { PrincipalDto } from '../models/principal.dto';

export interface IAuthenticationStrategy {
  execute(identificationService: IdentityAuthenticationServiceV1): Promise<Result<PrincipalDto, Error>>;
}