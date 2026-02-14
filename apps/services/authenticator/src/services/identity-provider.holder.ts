import { Injectable } from '@nestjs/common';
import { IdentityProviderService } from '@domains/identity/authentication';

@Injectable()
export class IdentityProviderServiceHolder {
  private provider: IdentityProviderService | undefined;

  set(provider: IdentityProviderService | undefined): void {
    this.provider = provider;
  }

  get(): IdentityProviderService | undefined {
    return this.provider;
  }
}
