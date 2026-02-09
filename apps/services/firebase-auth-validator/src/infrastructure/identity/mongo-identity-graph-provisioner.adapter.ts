import { err, ok, Result } from '@foundation/standard';
import { IIdentityGraphProvisioner } from '@domains/identity/authentication';
import { IdentityService } from '@domains/identity/authentication';

export class MongoIdentityGraphProvisionerAdapter implements IIdentityGraphProvisioner {
  constructor(private readonly linking: IdentityService) {}

  async ensureIdentity(
    provider: string,
    externalId: string
  ): Promise<Result<{ identityId: string; subjectId: string; created: boolean }, Error>> {
    const r = await this.linking.addIdentityNode(provider, externalId);
    if (!r.ok) return err(r.error);
    return ok({ identityId: r.value.identityId, subjectId: r.value.subjectId, created: r.value.created });
  }

  async deleteIdentity(provider: string, externalId: string): Promise<Result<boolean, Error>> {
    void provider;
    void externalId;
    return ok(true);
  }
}

