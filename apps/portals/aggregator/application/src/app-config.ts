import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { ApplicationConfig } from "@angular/core";
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withRouterConfig, withComponentInputBinding, Routes } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins'; 

import { ListingSearchService } from "../../libs/features/listing/search/services/listing-search.service";


export function createAppConfig(c: {
  routes: Routes,
}): ApplicationConfig {
  return {
    providers: [
      provideRouter(
        c.routes,
        withEnabledBlockingInitialNavigation(),
        withInMemoryScrolling({
          scrollPositionRestoration: 'disabled',
          anchorScrolling: 'disabled',
        }),
        withRouterConfig({
          onSameUrlNavigation: 'reload',
        }),
        withComponentInputBinding()
      ),
      provideHttpClient(withInterceptorsFromDi()),
      provideAnimations(),
      NG_EVENT_PLUGINS,
      //StoreDevtoolsModule.instrument()
      ListingSearchService,
    ],
  }
}