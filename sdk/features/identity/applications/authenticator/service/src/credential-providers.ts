import type {
  IUserAdminPort,
  AccountExportSource,
  PasswordRecovery,
} from '@sdk/features/identity/libs/management';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { err } from '@sdk/kernel/standard';
import {
  type AuthenticationStrategyFactory,
  type CredentialEmailVerification,
  type CredentialPasswordReset,
  type CredentialSessionRevoker,
  type CredentialTokenVerifier,
  type IAuthenticationRefreshToken,
  type PasswordSignIn,
  type RegistrationCredentials,
} from '@sdk/features/identity/libs/authentication';
import {
  MysqlLocalCredentials,
  localEmailVerification,
  localPasswordReset,
  localPasswordRecovery,
} from '@sdk/extras/identity-local';
import {
  FirebaseAccountExportSource,
  FirebasePasswordRecovery,
  FirebaseAdminIdTokenVerifier,
  FirebaseAdminUserAdminPort,
  FirebaseRestSessionGateway,
  FirebaseEmailVerification,
  FirebasePasswordReset,
  FirebaseGoogleCodeExchanger,
  FirebaseGithubCodeExchanger,
  FirebaseUserProvisioner,
  FirebaseTokenGenerator,
} from '@sdk/extras/identity-firebase';
import { GoogleAuthenticationStrategyFactory } from './strategy/google-strategy.factory';
import { GithubAuthenticationStrategyFactory } from './strategy/github-strategy.factory';
import { AnonymousAuthenticationStrategyFactory } from './strategy/anonymous-strategy.factory';

export const CREDENTIAL_ADAPTERS = Symbol('CREDENTIAL_ADAPTERS');

export interface CredentialAdapters {
  admin: IUserAdminPort;
  exports: AccountExportSource;
  recovery: PasswordRecovery;
  sessions: PasswordSignIn &
    RegistrationCredentials &
    IAuthenticationRefreshToken;
  verifier: CredentialTokenVerifier;
  revoker: CredentialSessionRevoker;
  email: CredentialEmailVerification;
  reset: CredentialPasswordReset;
  google: AuthenticationStrategyFactory<[string, string, string]>;
  github: AuthenticationStrategyFactory<[string, string]>;
  anonymous: AuthenticationStrategyFactory<[]>;
}

/** Provider selection belongs only at the application composition root. */
export function createCredentialAdapters(
  config: ConfigService,
  source: DataSource
): CredentialAdapters {
  if (config.get<string>('AUTH_PROVIDER') === 'local') {
    const credentials = new MysqlLocalCredentials(source);
    const disabled = {
      create: () => ({
        execute: async () =>
          err(new Error('Authentication method unavailable')),
      }),
    };
    return {
      admin: credentials,
      exports: credentials,
      recovery: localPasswordRecovery,
      sessions: credentials,
      verifier: credentials,
      revoker: credentials,
      email: localEmailVerification(credentials),
      reset: localPasswordReset,
      google: disabled,
      github: disabled,
      anonymous: disabled,
    };
  }
  const sessions = new FirebaseRestSessionGateway(
    config.getOrThrow<string>('FIREBASE_WEB_API_KEY')
  );
  const provisioner = new FirebaseUserProvisioner(),
    tokens = new FirebaseTokenGenerator();
  return {
    admin: new FirebaseAdminUserAdminPort(),
    exports: new FirebaseAccountExportSource(),
    recovery: new FirebasePasswordRecovery(
      config.getOrThrow<string>('FIREBASE_WEB_API_KEY')
    ),
    sessions,
    verifier: new FirebaseAdminIdTokenVerifier(),
    revoker: new FirebaseAdminUserAdminPort(),
    email: new FirebaseEmailVerification(
      config.getOrThrow<string>('FIREBASE_WEB_API_KEY')
    ),
    reset: new FirebasePasswordReset(
      config.getOrThrow<string>('FIREBASE_WEB_API_KEY')
    ),
    google: new GoogleAuthenticationStrategyFactory(
      new FirebaseGoogleCodeExchanger({
        clientId: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
        clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      }),
      provisioner,
      tokens,
      sessions
    ),
    github: new GithubAuthenticationStrategyFactory(
      new FirebaseGithubCodeExchanger({
        clientId: config.get<string>('GITHUB_CLIENT_ID') ?? '',
        clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? '',
      }),
      provisioner,
      tokens,
      sessions
    ),
    anonymous: new AnonymousAuthenticationStrategyFactory(sessions),
  };
}
