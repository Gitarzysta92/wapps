import { ApplicationConfig } from '@angular/core';
import { IdentityManagementService } from './application/identity-management.service';

export function provideIdentityManagementFeature(): ApplicationConfig {
  return {
    providers: [IdentityManagementService],
  };
}
