import { ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';

export const appConfigSSR: ApplicationConfig = {
  providers: [provideServerRendering()],
};

