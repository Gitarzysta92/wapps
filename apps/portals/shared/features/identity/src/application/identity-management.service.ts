import { IdentityDto } from "../../../../../../../libs/features/identity/management/models";
import { IIdentityProvider, IIdentityUpdater } from "../../../../../../../libs/features/identity/management/ports";


export abstract class IdentityManagementService {
  protected readonly abstract _identityProvider: IIdentityProvider;
  protected readonly abstract _identityUpdater: IIdentityUpdater;

  async updateIdentity(identity: IdentityDto): Promise<void> {
    await this._identityUpdater.updateIdentity(identity);
  }
}