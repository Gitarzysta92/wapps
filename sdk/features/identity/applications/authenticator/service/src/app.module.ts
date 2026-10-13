import { AccountFavoriteUpdates1791840019000 } from '@sdk/extras/identity-mysql';
import { AccountNotifications1791840016000 } from '@sdk/extras/identity-mysql';
import {
  CanonicalIdentity1791676804000,
  PrivateProfile1791676805000,
  AccountPreferences1791676806000,
  AccountFavorites1791676807000,
  ProfileAvatars1791676828000,
  ProfileFollows1791676829000,
  ProfileContactEmail1791676830000,
  ProfileBadges1791676831000,
  AccountExports1791676832000,
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
  AccountErasureCoordination1791840002000,
  ProfileBadgeErasure1791840003000,
  CreateIdentities1788566400000,
  IdentityEntity,
  MysqlCanonicalIdentities,
} from '@sdk/extras/identity-mysql';
import { DataSource } from 'typeorm';
import type { CanonicalIdentityStore } from '@sdk/features/identity/core';
import { TokenValidationService } from './services/token-validation.service';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  FirebaseAdminIdTokenVerifier,
  FirebaseUserProvisioner,
  FirebaseRestSessionGateway,
  FirebaseTokenGenerator,
  FirebaseGoogleCodeExchanger,
  FirebaseGithubCodeExchanger,
  FirebasePasswordReset,
  FirebaseEmailVerification,
} from '@sdk/extras/identity-firebase';
import {
  ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
  EMAIL_AUTHENTICATION_STRATEGY_FACTORY,
  GITHUB_AUTHENTICATION_STRATEGY_FACTORY,
  GITHUB_CODE_EXCHANGER,
  GOOGLE_AUTHENTICATION_STRATEGY_FACTORY,
  GOOGLE_CODE_EXCHANGER,
  IDENTITY_AUTH_SERVICE,
  REST_SESSION_GATEWAY,
  SWAGGER_DOCUMENT,
  TOKEN_GENERATOR,
  USER_PROVISIONER,
} from './tokens';
import { validateAuthenticatorEnv } from './config/env.validation';
import { swaggerDocument } from './swagger.document';
import { DocsController } from './controllers/docs.controller';
import { HealthController } from './controllers/health.controller';
import { PlatformController } from './controllers/platform.controller';
import { ValidationController } from './controllers/validation.controller';
import { AuthController } from './controllers/auth.controller';
import { EnrollmentController } from './controllers/enrollment.controller';
import { EmailVerificationController } from './controllers/email-verification.controller';
import { CredentialEmailAuthorityAdapter } from './infrastructure/credential-email-authority.adapter';
import { IdentityEventsPublisherHolder } from './services/identity-events-publisher.holder';
import { AuthEventEmitterAdapter } from './infrastructure/auth-event-emitter.adapter';
import { FirebaseRefreshTokenAdapter } from './infrastructure/firebase-refresh-token.adapter';
import { AnonymousAuthenticationStrategyFactory } from './strategy/anonymous-strategy.factory';
import { EmailAuthenticationStrategyFactory } from './strategy/email-strategy.factory';
import { GithubAuthenticationStrategyFactory } from './strategy/github-strategy.factory';
import { GoogleAuthenticationStrategyFactory } from './strategy/google-strategy.factory';
import {
  CredentialPasswordResetService,
  CredentialEmailVerificationService,
  CredentialRegistrationService,
  InitialAccountEnrollment,
  IdentityAuthenticationService,
} from '@sdk/features/identity/libs/authentication';
import {
  CANONICAL_IDENTITIES,
  MysqlIdentityProvider,
} from './services/mysql-identity-provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAuthenticatorEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('MYSQL_HOST'),
        port: parseInt(config.get<string>('MYSQL_PORT') ?? '3306', 10),
        username: config.get<string>('MYSQL_USERNAME'),
        password: config.get<string>('MYSQL_PASSWORD'),
        database: config.get<string>('MYSQL_DATABASE'),
        entities: [IdentityEntity],
        synchronize: false,
        migrations: [
          CreateIdentities1788566400000,
          CanonicalIdentity1791676804000,
          PrivateProfile1791676805000,
          AccountPreferences1791676806000,
          AccountFavorites1791676807000,
          ProfileAvatars1791676828000,
          ProfileFollows1791676829000,
          ProfileContactEmail1791676830000,
          ProfileBadges1791676831000,
          AccountExports1791676832000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
          AccountErasureCoordination1791840002000,
          ProfileBadgeErasure1791840003000,
          AccountNotifications1791840016000,
          AccountFavoriteUpdates1791840019000,
        ],
        migrationsRun: false,
        migrationsTransactionMode: 'none',
        logging: false,
      }),
    }),
  ],
  controllers: [
    DocsController,
    HealthController,
    PlatformController,
    ValidationController,
    AuthController,
    EnrollmentController,
    EmailVerificationController,
  ],
  providers: [
    TokenValidationService,
    CredentialEmailAuthorityAdapter,
    {
      provide: CredentialEmailVerificationService,
      inject: [CredentialEmailAuthorityAdapter, ConfigService],
      useFactory: (
        authority: CredentialEmailAuthorityAdapter,
        config: ConfigService
      ) =>
        new CredentialEmailVerificationService(
          authority,
          new FirebaseEmailVerification(
            config.get<string>('FIREBASE_WEB_API_KEY') ?? ''
          )
        ),
    },
    IdentityEventsPublisherHolder,
    {
      provide: CANONICAL_IDENTITIES,
      inject: [DataSource],
      useFactory: async (source: DataSource) => {
        if (await source.showMigrations())
          throw new Error('Run identity --migrate before starting services');
        return new MysqlCanonicalIdentities(source);
      },
    },
    {
      provide: SWAGGER_DOCUMENT,
      useValue: swaggerDocument,
    },
    FirebaseAdminIdTokenVerifier,
    {
      provide: REST_SESSION_GATEWAY,
      useFactory: (config: ConfigService) =>
        new FirebaseRestSessionGateway(
          config.get<string>('FIREBASE_WEB_API_KEY')
        ),
      inject: [ConfigService],
    },
    {
      provide: IDENTITY_AUTH_SERVICE,
      useFactory: (
        sessionGateway: FirebaseRestSessionGateway,
        identityProvider: MysqlIdentityProvider,
        identities: CanonicalIdentityStore
      ) => {
        const eventsEmitter = new AuthEventEmitterAdapter(identities);
        const authenticationRefreshToken = new FirebaseRefreshTokenAdapter(
          sessionGateway
        );
        return new IdentityAuthenticationService(
          identityProvider,
          eventsEmitter,
          authenticationRefreshToken
        );
      },
      inject: [
        REST_SESSION_GATEWAY,
        MysqlIdentityProvider,
        CANONICAL_IDENTITIES,
      ],
    },
    MysqlIdentityProvider,
    {
      provide: CredentialRegistrationService,
      inject: [REST_SESSION_GATEWAY, CANONICAL_IDENTITIES],
      useFactory: (
        credentials: FirebaseRestSessionGateway,
        identities: CanonicalIdentityStore & InitialAccountEnrollment
      ) =>
        new CredentialRegistrationService(credentials, identities, identities),
    },
    {
      provide: CredentialPasswordResetService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CredentialPasswordResetService(
          new FirebasePasswordReset(
            config.getOrThrow<string>('FIREBASE_WEB_API_KEY')
          )
        ),
    },
    {
      provide: USER_PROVISIONER,
      useClass: FirebaseUserProvisioner,
    },
    {
      provide: TOKEN_GENERATOR,
      useClass: FirebaseTokenGenerator,
    },
    {
      provide: GOOGLE_CODE_EXCHANGER,
      useFactory: (config: ConfigService) =>
        new FirebaseGoogleCodeExchanger({
          clientId: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
          clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
        }),
      inject: [ConfigService],
    },
    {
      provide: GITHUB_CODE_EXCHANGER,
      useFactory: (config: ConfigService) =>
        new FirebaseGithubCodeExchanger({
          clientId: config.get<string>('GITHUB_CLIENT_ID') ?? '',
          clientSecret: config.get<string>('GITHUB_CLIENT_SECRET') ?? '',
        }),
      inject: [ConfigService],
    },
    {
      provide: GOOGLE_AUTHENTICATION_STRATEGY_FACTORY,
      useFactory: (
        googleExchanger: FirebaseGoogleCodeExchanger,
        userProvisioner: FirebaseUserProvisioner,
        tokenGenerator: FirebaseTokenGenerator,
        restGateway: FirebaseRestSessionGateway
      ) =>
        new GoogleAuthenticationStrategyFactory(
          googleExchanger,
          userProvisioner,
          tokenGenerator,
          restGateway
        ),
      inject: [
        GOOGLE_CODE_EXCHANGER,
        USER_PROVISIONER,
        TOKEN_GENERATOR,
        REST_SESSION_GATEWAY,
      ],
    },
    {
      provide: GITHUB_AUTHENTICATION_STRATEGY_FACTORY,
      useFactory: (
        githubExchanger: FirebaseGithubCodeExchanger,
        userProvisioner: FirebaseUserProvisioner,
        tokenGenerator: FirebaseTokenGenerator,
        restGateway: FirebaseRestSessionGateway
      ) =>
        new GithubAuthenticationStrategyFactory(
          githubExchanger,
          userProvisioner,
          tokenGenerator,
          restGateway
        ),
      inject: [
        GITHUB_CODE_EXCHANGER,
        USER_PROVISIONER,
        TOKEN_GENERATOR,
        REST_SESSION_GATEWAY,
      ],
    },
    {
      provide: EMAIL_AUTHENTICATION_STRATEGY_FACTORY,
      useFactory: (restGateway: FirebaseRestSessionGateway) =>
        new EmailAuthenticationStrategyFactory(restGateway),
      inject: [REST_SESSION_GATEWAY],
    },
    {
      provide: ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
      useFactory: (restGateway: FirebaseRestSessionGateway) =>
        new AnonymousAuthenticationStrategyFactory(restGateway),
      inject: [REST_SESSION_GATEWAY],
    },
  ],
})
export class AppModule {}
