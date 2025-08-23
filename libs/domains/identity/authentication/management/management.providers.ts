import { ApplicationConfig } from "@angular/core";
import { IdentityNotificationsService } from "./aspect/notification.adapter";
import { EVENT_LISTENER, IDENTITY_PROVIDER, IDENTITY_UPDATER } from "./application/ports";
import { IdentityApiService } from "./infrastructure";
import { IdentityManagementService } from "./application";



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