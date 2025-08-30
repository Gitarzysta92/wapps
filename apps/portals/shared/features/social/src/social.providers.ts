import { ApplicationConfig } from "@angular/core";
import { SOCIALS_PROVIDER, SocialService } from "./application";
import { SocialApiService } from "./infrastructure/social-api.service";

export function provideSocialsFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: SOCIALS_PROVIDER, useClass: SocialApiService },
      SocialService
    ]
  }
}