import { bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { createAppConfig, routes, AppRootComponent, APPLICATION_ROOT } from '@portals/discussion/application';

bootstrapApplication(
  AppRootComponent,
  mergeApplicationConfig(createAppConfig({ routes }), APPLICATION_ROOT)
).catch((err) => console.error(err));

