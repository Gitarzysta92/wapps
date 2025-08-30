import { ApplicationConfig } from "@angular/core";
import { SOCIALS_PROVIDER, SocialService } from "./src/application";
import { SocialApiService } from "./src/infrastructure/social-api.service";

export function provideListingSocialsFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: SOCIALS_PROVIDER, useClass: SocialApiService },
      SocialService
    ]
  }
}