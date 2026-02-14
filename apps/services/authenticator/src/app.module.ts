import { Module } from '@nestjs/common';

import {
  FirebaseAdminIdTokenVerifier,
  FirebaseUserProvisioner,
  FirebaseRestSessionGateway,
  FirebaseTokenGenerator,
  FirebaseGoogleCodeExchanger,
  FirebaseGithubCodeExchanger,
} from '@infrastructure/firebase-identity';
import {
  ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
  APP_CONFIG,
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
import { readConfigFromEnv } from './app-config';
import { swaggerDocument } from './swagger.document';
import { DocsController } from './controllers/docs.controller';
import { HealthController } from './controllers/health.controller';
import { PlatformController } from './controllers/platform.controller';
import { ValidationController } from './controllers/validation.controller';
import { AuthController } from './controllers/auth.controller';
import { IdentityGraphProvisionerHolder } from './identity/identity-graph-provisioner.holder';
import { IdentityEventsPublisherHolder } from './identity/identity-events-publisher.holder';
import { IdentityProviderServiceHolder } from './identity/identity-provider.holder';
import { IdentityBootstrappersService } from './identity/identity-bootstrappers.service';
import { LazyIdentityProviderServiceAdapter } from './infrastructure/identity/lazy-identity-provider.adapter';
import { AuthEventEmitterAdapter } from './infrastructure/identity/auth-event-emitter.adapter';
import { FirebaseRefreshTokenAdapter } from './infrastructure/identity/firebase-refresh-token.adapter';
import { AnonymousAuthenticationStrategyFactory } from './strategy/anonymous-strategy.factory';
import { EmailAuthenticationStrategyFactory } from './strategy/email-strategy.factory';
import { GithubAuthenticationStrategyFactory } from './strategy/github-strategy.factory';
import { GoogleAuthenticationStrategyFactory } from './strategy/google-strategy.factory';
import { IdentityAuthenticationService } from '@domains/identity/authentication';

@Module({
  controllers: [DocsController, HealthController, PlatformController, ValidationController, AuthController],
  providers: [
    IdentityGraphProvisionerHolder,
    IdentityEventsPublisherHolder,
    IdentityProviderServiceHolder,
    IdentityBootstrappersService,
    {
      provide: APP_CONFIG,
      useFactory: () => readConfigFromEnv(),
    },
    {
      provide: SWAGGER_DOCUMENT,
      useValue: swaggerDocument,
    },
    FirebaseAdminIdTokenVerifier,
    {
      provide: REST_SESSION_GATEWAY,
      useFactory: (config: ReturnType<typeof readConfigFromEnv>) =>
        new FirebaseRestSessionGateway(config.firebaseWebApiKey),
      inject: [APP_CONFIG],
    },
    {
      provide: IDENTITY_AUTH_SERVICE,
      useFactory: (
        sessionGateway: FirebaseRestSessionGateway,
        identityProviderHolder: IdentityProviderServiceHolder,
        eventsPublisherHolder: IdentityEventsPublisherHolder
      ) => {
        const identityProvider = new LazyIdentityProviderServiceAdapter(identityProviderHolder);
        const eventsEmitter = new AuthEventEmitterAdapter(eventsPublisherHolder);
        const authenticationRefreshToken = new FirebaseRefreshTokenAdapter(sessionGateway);
        return new IdentityAuthenticationService(identityProvider, eventsEmitter, authenticationRefreshToken);
      },
      inject: [REST_SESSION_GATEWAY, IdentityProviderServiceHolder, IdentityEventsPublisherHolder],
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
      useFactory: (config: ReturnType<typeof readConfigFromEnv>) =>
        new FirebaseGoogleCodeExchanger({
          clientId: config.oauth.googleClientId ?? '',
          clientSecret: config.oauth.googleClientSecret ?? '',
        }),
      inject: [APP_CONFIG],
    },
    {
      provide: GITHUB_CODE_EXCHANGER,
      useFactory: (config: ReturnType<typeof readConfigFromEnv>) =>
        new FirebaseGithubCodeExchanger({
          clientId: config.oauth.githubClientId ?? '',
          clientSecret: config.oauth.githubClientSecret ?? '',
        }),
      inject: [APP_CONFIG],
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
      inject: [GOOGLE_CODE_EXCHANGER, USER_PROVISIONER, TOKEN_GENERATOR, REST_SESSION_GATEWAY],
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
      inject: [GITHUB_CODE_EXCHANGER, USER_PROVISIONER, TOKEN_GENERATOR, REST_SESSION_GATEWAY],
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

