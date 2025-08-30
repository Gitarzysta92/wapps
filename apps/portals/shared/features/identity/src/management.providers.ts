import { ApplicationConfig } from "@angular/core";
import { IdentityNotificationsService } from "./management/notification.adapter";
import { EVENT_LISTENER, IDENTITY_PROVIDER, IDENTITY_UPDATER } from "@domains/identity";
import { IdentityApiService } from "@features/identity";
import { IdentityManagementService } from "@features/identity";



export function provideIdentityManagementFeature(): ApplicationConfig {
  return {
    providers: [
      IdentityManagementService,
      { provide: EVENT_LISTENER, useClass: IdentityNotificationsService },
      { provide: IDENTITY_PROVIDER, useClass: IdentityApiService },
      { provide: IDENTITY_UPDATER, useClass: IdentityApiService },
    ]
  }
}