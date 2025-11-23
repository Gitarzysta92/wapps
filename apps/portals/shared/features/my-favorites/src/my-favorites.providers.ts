import { ApplicationConfig } from "@angular/core";
import { MyFavoritesApiService } from "./infrastructure/my-favorites-api.service";
import { MyFavoritesService } from "./application/my-favorites.service";
import { MY_FAVORITES_API_BASE_URL_PROVIDER } from "./application/infrastructure-providers.port";
import { MY_FAVORITES_STATE_PROVIDER } from "./application/my-favorites-state-provider.token";
import { MY_FAVORITES_PROVIDER } from "./application/my-favorites-provider.token";

export function provideMyFavoritesFeature(c: {
  apiBaseUrl: string
}): ApplicationConfig {
  return {
    providers: [
      { provide: MY_FAVORITES_STATE_PROVIDER, useClass: MyFavoritesService },
      { provide: MY_FAVORITES_PROVIDER, useClass: MyFavoritesApiService },
      { provide: MY_FAVORITES_API_BASE_URL_PROVIDER, useValue: c.apiBaseUrl },
      MyFavoritesService
    ]
  }
}

