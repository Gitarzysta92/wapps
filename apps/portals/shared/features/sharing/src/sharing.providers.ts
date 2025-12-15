import { ApplicationConfig } from "@angular/core";
import { SharingApiService } from "./infrastructure/sharing-api.service";
import { SharingService } from "./application/sharing.service";
import { SHARING_BASE_URL_PROVIDER } from "./application/infrastructure-providers.port";
import { SHARING_PROVIDER } from "./application/sharing-provider.token";

export function provideSharingFeature(c: {
  baseUrl: string
}): ApplicationConfig {
  return {
    providers: [
      { provide: SHARING_PROVIDER, useClass: SharingApiService },
      { provide: SHARING_BASE_URL_PROVIDER, useValue: c.baseUrl },
      SharingService
    ]
  }
}
