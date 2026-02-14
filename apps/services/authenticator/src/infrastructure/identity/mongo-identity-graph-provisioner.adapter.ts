import { err, ok, Result } from '@foundation/standard';
import { IIdentityGraphProvisioner } from '@domains/identity/authentication';
import { IdentityProviderService } from '@domains/identity/authentication';

export class MongoIdentityGraphProvisionerAdapter implements IIdentityGraphProvisioner {
  constructor(private readonly linking: IdentityProviderService) {}

  async ensureIdentity(
    provider: string,
    claim: string
  ): Promise<Result<{ identityId: string; subjectId: string; created: boolean }, Error>> {
    const r = await this.linking.createIdentity(provider, claim);
    if (!r.ok) return err(r.error);
    return ok({ identityId: r.value.identityId, subjectId: r.value.subjectId, created: r.value.created });
  }

  async deleteIdentity(provider: string, claim: string): Promise<Result<boolean, Error>> {
    void provider;
    void claim;
    return ok(true);
  }
}

