import { ApplicationConfig } from "@angular/core";
import { ProfileApiServiceAdapter } from "./infrastructure/profile-api-service.adapter";
import { PROFILE_PROVIDER } from "./application/ports/profile-provider.token";

export function provideProfileFeature(): ApplicationConfig {
  return {
    providers: [
      {
        provide: PROFILE_PROVIDER,
        useClass: ProfileApiServiceAdapter
      }
    ]
  }
}