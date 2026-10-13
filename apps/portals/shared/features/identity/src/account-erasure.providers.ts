import {
  inject,
  Injector,
  runInInjectionContext,
  type Provider,
} from '@angular/core';
import { defer, switchMap } from 'rxjs';
import {
  ACCOUNT_ERASURE,
  ACCOUNT_ERASURE_URL,
  type AccountErasurePort,
} from './application/account-erasure.port';

/** Install once at the application root to retain in-flight outcomes across navigation. */
export function provideAccountErasure(apiUrl: string): Provider[] {
  return [
    { provide: ACCOUNT_ERASURE_URL, useValue: apiUrl },
    {
      provide: ACCOUNT_ERASURE,
      useFactory: (): AccountErasurePort => {
        const injector = inject(Injector);
        let adapter: Promise<AccountErasurePort> | undefined;
        const load = () =>
          (adapter ??= import('./infrastructure/account-erasure-api.service')
            .then(({ AccountErasureApiService }) =>
              runInInjectionContext(
                injector,
                () => new AccountErasureApiService()
              )
            )
            .catch((error) => {
              adapter = undefined;
              throw error;
            }));
        return {
          prepare: () => defer(load).pipe(switchMap((port) => port.prepare())),
          request: (identityId) =>
            defer(load).pipe(switchMap((port) => port.request(identityId))),
        };
      },
    },
  ];
}
