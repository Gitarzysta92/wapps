import { IAuthenticationStrategy, PrincipalDto } from "@domains/identity/authentication";
import { Result, err, isErr, ok } from "@foundation/standard";
import { IIdentitySystemRepository } from "@foundation/identity-system";

export class EmailPasswordAuthenticationStrategy implements IAuthenticationStrategy {
  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly identityRepository: IIdentitySystemRepository,
  ) { }

  async execute(): Promise<Result<PrincipalDto, Error>> {
    const result = await this.identityRepository.getIdentityByProviderSecret(`${this.email}:${this.password}`);
    
    if (isErr(result)) {  
      return err(result.error);
    }
    return result.value;
  }


}