import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { ApplicationConfig } from "@angular/core";
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling, withRouterConfig, withComponentInputBinding, Routes } from "@angular/router";
import { provideAnimations } from "@angular/platform-browser/animations";
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';
import { TUI_ASSETS_PATH, tuiAssetsPathProvider } from '@taiga-ui/core'; 

export function createAppConfig(c: {
  routes: Routes,
}): ApplicationConfig {
  return {
    providers: [
      provideRouter(
        c.routes,
        withEnabledBlockingInitialNavigation(),
        withInMemoryScrolling({
          scrollPositionRestoration: 'top',
          anchorScrolling: 'enabled',
        }),
        withRouterConfig({
          onSameUrlNavigation: 'reload',
        }),
        withComponentInputBinding()
      ),
      provideHttpClient(withInterceptorsFromDi()),
      provideAnimations(),
      NG_EVENT_PLUGINS,
      tuiAssetsPathProvider('assets/taiga-ui/icons'),
      //StoreDevtoolsModule.instrument()
    ],
  }
}