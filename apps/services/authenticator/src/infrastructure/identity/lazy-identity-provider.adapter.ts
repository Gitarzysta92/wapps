import { err } from '@foundation/standard';
import { IIdentityProvider, IdentityCreationDto } from '@domains/identity/authentication';
import { IdentityProviderServiceHolder } from '../../identity/identity-provider.holder';

export class LazyIdentityProviderServiceAdapter implements IIdentityProvider {
  constructor(private readonly holder: IdentityProviderServiceHolder) {}

  async obtainIdentity(claim: string): Promise<Result<Identity, Error>> {
    const provider = this.holder.get();
    if (!provider) {
      return err(new Error('Identity provider not configured'));
    }
    return provider.obtainIdentity(claim);
  }

  async createIdentity(
    identityCreationDto: IdentityCreationDto,
    extras: { activate?: boolean } = { activate: false }
  ): Promise<Result<Identity, Error>> {
    const provider = this.holder.get();
    if (!provider) {
      return err(new Error('Identity provider not configured'));
    }
    return provider.createIdentity(identityCreationDto, extras);
  }
}
