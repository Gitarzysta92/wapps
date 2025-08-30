import { ApplicationConfig } from "@angular/core";
import { IdentityNotificationsService } from "./aspect/notification.adapter";
import { EVENT_LISTENER, IDENTITY_PROVIDER, IDENTITY_UPDATER } from "../../../../../../libs/features/identity/management/application/ports";
import { IdentityApiService } from "../../../../../../libs/features/identity/management/infrastructure";
import { IdentityManagementService } from "../../../../../../libs/features/identity/management/application";



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