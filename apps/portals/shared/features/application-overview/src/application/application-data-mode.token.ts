import { InjectionToken } from '@angular/core';

export const LOCAL_APPLICATION_DATA = new InjectionToken<boolean>(
  'LOCAL_APPLICATION_DATA',
  { factory: () => false }
);
