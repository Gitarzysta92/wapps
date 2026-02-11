import { ok } from "assert";
import { IAuthenticationStrategy, PrincipalDto } from '@domains/identity/authentication';
import { Result } from '@foundation/standard';

export class AnonymousAuthenticationStrategy implements IAuthenticationStrategy {

  async execute(): Promise<Result<PrincipalDto, Error>> {
    return ok({ anonymous: true });
  }
}