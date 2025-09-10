import { ApplicationConfig } from "@angular/core";
import { IDENTITY_PROVIDER } from "./application/identity-provider.token";
import { IDENTITY_UPDATER } from "./application/identity-updater.token";
import { IdentityApiService } from "./infrastructure/identity-api.service";
import { IdentityManagementService } from "./application/identity-management.service";



export function provideIdentityManagementFeature(): ApplicationConfig {
  return {
    providers: [
      IdentityManagementService,
      { provide: IDENTITY_PROVIDER, useClass: IdentityApiService },
      { provide: IDENTITY_UPDATER, useClass: IdentityApiService },
    ]
  }
}