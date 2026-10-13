import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ApplicationConfig, Provider, Type } from '@angular/core';
import {
  ValidationMessages as LoginValidationMessages,
  VALIDATION_MESSAGES,
} from '@ui/login';
import { IAuthenticationHandler } from '@sdk/features/identity/libs/authentication';
import { AUTHENTICATION_HANDLER } from './application/authentication-handler.token';
import { IDENTITY_PROVIDER } from './application/identity-provider.token';
import { AuthenticationService } from './application/authentication.service';
import { AUTHENTICATION_SESSION } from './application/authentication-session.port';
import { AuthenticationStorage } from './infrastructure/authentication.storage';
import { AuthenticationApiService } from './infrastructure/authentication-api.service';
import {
  IdentityApiService,
  DemoIdentityService,
} from './infrastructure/identity-api.service';
import {
  AuthenticationInterceptor,
  AUTHENTICATED_ORIGINS,
} from './infrastructure/authentication.interceptor';
import { BffAuthenticationService } from './infrastructure/bff/bff-authentication.service';
import { AUTH_BFF_URL } from './infrastructure/bff/auth-bff-url.token';
import { IDENTITY_CONNECTION } from './infrastructure/identity-connection';
import { OAUTH_CALLBACK_HANDLER } from './application/oauth-callback.port';

export interface IdentityLoginFeatureConfig {
  validationMessages: LoginValidationMessages;
  mode: 'api' | 'demo';
  /** Empty string explicitly selects the current-origin gateway. */
  authBffUrl: string;
  accountApiUrl: string;
  authenticatedOrigins?: string[];
  authenticationHandler?: Type<IAuthenticationHandler>;
}

export function provideIdentityLoginFeature(
  c: IdentityLoginFeatureConfig
): ApplicationConfig {
  if (
    !['api', 'demo'].includes(c.mode) ||
    typeof c.authBffUrl !== 'string' ||
    typeof c.accountApiUrl !== 'string'
  )
    throw new Error(
      'Identity requires an explicit mode and authentication/account endpoints'
    );
  for (const endpoint of [c.authBffUrl, c.accountApiUrl]) {
    if (endpoint === '') continue;
    const url = new URL(endpoint);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error(
        'Identity endpoints must be HTTP origins or an explicit empty same-origin endpoint'
      );
  }
  const providers: Provider[] = [
    AuthenticationStorage,
    { provide: AUTHENTICATION_SESSION, useExisting: AuthenticationStorage },
    {
      provide: IDENTITY_CONNECTION,
      useValue: {
        mode: c.mode,
        authBaseUrl: c.authBffUrl,
        accountBaseUrl: c.accountApiUrl,
      },
    },
    { provide: AUTH_BFF_URL, useValue: c.authBffUrl },
    {
      provide: AUTHENTICATED_ORIGINS,
      useValue: [
        ...(c.authenticatedOrigins ?? []),
        ...(c.accountApiUrl ? [new URL(c.accountApiUrl).origin] : []),
      ],
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthenticationInterceptor,
      multi: true,
    },
    AuthenticationService,
    BffAuthenticationService,
    { provide: OAUTH_CALLBACK_HANDLER, useExisting: BffAuthenticationService },
    { provide: VALIDATION_MESSAGES, useValue: c.validationMessages },
    {
      provide: IDENTITY_PROVIDER,
      useClass: c.mode === 'demo' ? DemoIdentityService : IdentityApiService,
    },
    {
      provide: AUTHENTICATION_HANDLER,
      useClass:
        c.authenticationHandler ??
        (c.mode === 'demo'
          ? AuthenticationApiService
          : BffAuthenticationService),
    },
  ];
  return { providers };
}
