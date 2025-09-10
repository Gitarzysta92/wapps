import { Injectable } from "@angular/core";
import { IdentityDto, IIdentityProvider, IIdentityUpdater } from "@domains/identity/authentication";



@Injectable()
export class IdentityManagementService {
  // protected readonly _identityProvider: IIdentityProvider;
  // protected readonly _identityUpdater: IIdentityUpdater;

  async updateIdentity(identity: IdentityDto): Promise<void> {
    // await this._identityUpdater.updateIdentity(identity);
  }
}