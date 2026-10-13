import { inject, Injectable } from '@angular/core';
import { IDENTITY_PROVIDER } from './identity-provider.token';
@Injectable()
export class IdentityManagementService {
  private readonly identities = inject(IDENTITY_PROVIDER);

  getIdentity() {
    return this.identities.getIdentity();
  }
}
