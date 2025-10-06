import { bootstrapApplication } from '@angular/platform-browser';
import { createAppConfig, routes, AppRootComponent, APPLICATION_ROOT } from '@portals/aggregator-demo/application';
import { mergeApplicationConfig } from '@angular/core';

bootstrapApplication(AppRootComponent,
  mergeApplicationConfig(
    createAppConfig({ routes }),
    APPLICATION_ROOT
  )
).catch((err) => console.error(err));
