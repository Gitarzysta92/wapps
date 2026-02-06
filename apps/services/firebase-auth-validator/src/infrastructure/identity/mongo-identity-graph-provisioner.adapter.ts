import { err, ok, Result } from '@foundation/standard';
import { IIdentityGraphProvisioner } from '@domains/identity/identification';
import { IdentityProvisioner } from './identity-provisioner';

export class MongoIdentityGraphProvisionerAdapter implements IIdentityGraphProvisioner {
  constructor(private readonly provisioner: IdentityProvisioner) {}

  async ensureIdentityForFirebaseUid(
    uid: string
  ): Promise<Result<{ identityId: string; subjectId: string; created: boolean }, Error>> {
    const r = await this.provisioner.ensureForFirebaseUid(uid);
    if (!r.ok) return err(r.error);
    return ok({ identityId: r.value.identityId, subjectId: r.value.subjectId, created: r.value.created });
  }

  async deleteIdentityForFirebaseUid(_uid: string): Promise<Result<boolean, Error>> {
    return ok(true);
  }
}

