import { ConfigService } from '@nestjs/config';
import type {
  CanonicalIdentityStore,
  CredentialIdentityBindings,
} from '@sdk/features/identity/core';
import {
  CredentialEmailVerificationService,
  CredentialPasswordResetService,
  CredentialRegistrationService,
  IdentityAuthenticationService,
  InitialAccountEnrollment,
} from '@sdk/features/identity/libs/authentication';
import { err } from '@sdk/kernel/standard';
import { RemoteCredentials } from './remote-credentials';
import { CANONICAL_IDENTITIES } from '../services/identity-state.tokens';
import { TokenValidationService } from './services/token-validation.service';
import { MysqlIdentityProvider } from './services/mysql-identity-provider';
import { CredentialEmailAuthorityAdapter } from './infrastructure/credential-email-authority.adapter';
import { AuthEventEmitterAdapter } from './infrastructure/auth-event-emitter.adapter';
import { EmailAuthenticationStrategyFactory } from './strategy/email-strategy.factory';
import {
  CREDENTIAL_TOKEN_VERIFIER,
  CREDENTIAL_SESSION_REVOKER,
  IDENTITY_AUTH_SERVICE,
  EMAIL_AUTHENTICATION_STRATEGY_FACTORY,
  GOOGLE_AUTHENTICATION_STRATEGY_FACTORY,
  GITHUB_AUTHENTICATION_STRATEGY_FACTORY,
  ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
} from './tokens';

export const authenticationProviders = [
  {
    provide: RemoteCredentials,
    inject: [ConfigService, CANONICAL_IDENTITIES],
    useFactory: (
      config: ConfigService,
      identities: CredentialIdentityBindings
    ) =>
      new RemoteCredentials(
        config.getOrThrow<string>('AUTHENTICATION_URL'),
        config.getOrThrow<string>('AUTH_ISSUER'),
        config.getOrThrow<string>('AUTH_SERVICE_SECRET'),
        identities
      ),
  },
  { provide: CREDENTIAL_TOKEN_VERIFIER, useExisting: RemoteCredentials },
  { provide: CREDENTIAL_SESSION_REVOKER, useExisting: RemoteCredentials },
  MysqlIdentityProvider,
  TokenValidationService,
  CredentialEmailAuthorityAdapter,
  {
    provide: IDENTITY_AUTH_SERVICE,
    inject: [MysqlIdentityProvider, CANONICAL_IDENTITIES, RemoteCredentials],
    useFactory: (
      identities: MysqlIdentityProvider,
      store: CanonicalIdentityStore,
      credentials: RemoteCredentials
    ) =>
      new IdentityAuthenticationService(
        identities,
        new AuthEventEmitterAdapter(store),
        credentials
      ),
  },
  {
    provide: CredentialRegistrationService,
    inject: [RemoteCredentials, CANONICAL_IDENTITIES],
    useFactory: (
      credentials: RemoteCredentials,
      store: CanonicalIdentityStore &
        CredentialIdentityBindings &
        InitialAccountEnrollment
    ) =>
      new CredentialRegistrationService(
        credentials,
        store,
        store,
        credentials.issuer
      ),
  },
  {
    provide: CredentialPasswordResetService,
    inject: [RemoteCredentials],
    useFactory: (credentials: RemoteCredentials) =>
      new CredentialPasswordResetService(credentials.reset),
  },
  {
    provide: CredentialEmailVerificationService,
    inject: [RemoteCredentials, CredentialEmailAuthorityAdapter],
    useFactory: (
      credentials: RemoteCredentials,
      authority: CredentialEmailAuthorityAdapter
    ) => new CredentialEmailVerificationService(authority, credentials.email),
  },
  {
    provide: EMAIL_AUTHENTICATION_STRATEGY_FACTORY,
    inject: [RemoteCredentials],
    useFactory: (credentials: RemoteCredentials) =>
      new EmailAuthenticationStrategyFactory(credentials),
  },
  ...[
    GOOGLE_AUTHENTICATION_STRATEGY_FACTORY,
    GITHUB_AUTHENTICATION_STRATEGY_FACTORY,
    ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
  ].map((provide) => ({
    provide,
    useValue: {
      create: () => ({
        execute: async () =>
          err(new Error('Authentication method unavailable')),
      }),
    },
  })),
];
