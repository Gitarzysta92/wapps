import { bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import {
  APPLICATION_ROOT,
  AppRootComponent,
  createAppConfig,
  routes,
} from '@portals/management-portal/application';

bootstrapApplication(
  AppRootComponent,
  mergeApplicationConfig(createAppConfig({ routes }), APPLICATION_ROOT)
).catch((err) => console.error(err));

