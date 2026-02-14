import { Module } from '@nestjs/common';

import {
  FirebaseAdminIdTokenVerifier,
  FirebaseUserProvisioner,
  FirebaseRestSessionGateway,
  FirebaseGoogleCodeExchanger,
  FirebaseGithubCodeExchanger,
} from '@infrastructure/firebase-identity';
import {
  ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
  APP_CONFIG,
  IDENTITY_AUTH_SERVICE,
  OAUTH_CODE_EXCHANGER,
  SWAGGER_DOCUMENT,
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
import { IdentityBootstrappersService } from './identity/identity-bootstrappers.service';
import { AnonymousAuthenticationStrategyFactory } from './strategy/anonymous-strategy.factory';

@Module({
  controllers: [DocsController, HealthController, PlatformController, ValidationController, AuthController],
  providers: [
    IdentityGraphProvisionerHolder,
    IdentityEventsPublisherHolder,
    IdentityBootstrappersService,
    {
      provide: APP_CONFIG,
      useFactory: () => readConfigFromEnv(),
    },
    {
      provide: SWAGGER_DOCUMENT,
      useValue: swaggerDocument,
    },
    {
      provide: OAUTH_CODE_EXCHANGER,
      useFactory: (config: ReturnType<typeof readConfigFromEnv>): IOAuthCodeExchanger => {
        const google =
          config.oauth.googleClientId && config.oauth.googleClientSecret
            ? new FirebaseGoogleCodeExchanger({
                clientId: config.oauth.googleClientId,
                clientSecret: config.oauth.googleClientSecret,
              })
            : null;
        const github =
          config.oauth.githubClientId && config.oauth.githubClientSecret
            ? new FirebaseGithubCodeExchanger({
                clientId: config.oauth.githubClientId,
                clientSecret: config.oauth.githubClientSecret,
              })
            : null;
        return {
          async exchangeCode(provider, code, redirectUri, codeVerifier) {
            try {
              if (provider === 'google') {
                if (!google) return { ok: false, error: new Error('Google OAuth not configured') };
                return await google.exchangeCode(code, redirectUri, codeVerifier);
              }
              if (provider === 'github') {
                if (!github) return { ok: false, error: new Error('GitHub OAuth not configured') };
                return await github.exchangeCode(code, redirectUri);
              }
              return { ok: false, error: new Error(`Unknown provider: ${provider}`) };
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : 'OAuth exchange failed';
              return { ok: false, error: new Error(message) };
            }
          },
        };
      },
      inject: [APP_CONFIG],
    },
    {
      provide: IDENTITY_AUTH_SERVICE,
      useFactory: (
        config: ReturnType<typeof readConfigFromEnv>,
        oauthCodeExchanger: IOAuthCodeExchanger,
        graphHolder: IdentityGraphProvisionerHolder,
        eventsHolder: IdentityEventsPublisherHolder
      ) => {
        return new IdentityAuthenticationServiceV2(
          new FirebaseAdminIdTokenVerifier(),
          new FirebaseRestSessionGateway(config.firebaseWebApiKey),
          new FirebaseUserProvisioner(),
          oauthCodeExchanger,
          {
            enabledEmailPassword: config.providers.enableEmailPassword,
            enabledGoogle: config.providers.enableGoogle,
            enabledGithub: config.providers.enableGithub,
            enabledAnonymous: config.providers.enableAnonymous,
            identityProvider: 'firebase',
            googleClientId: config.oauth.googleClientId,
            googleClientSecret: config.oauth.googleClientSecret,
            githubClientId: config.oauth.githubClientId,
            githubClientSecret: config.oauth.githubClientSecret,
          },
          () => graphHolder.get(),
          ({ identityId, subjectId }) => {
            // best-effort cross-cutting: identity.created event
            eventsHolder.get()?.publishCreated({ identityId, subjectId, correlationId: identityId });
          }
        );
      },
      inject: [APP_CONFIG, OAUTH_CODE_EXCHANGER, IdentityGraphProvisionerHolder, IdentityEventsPublisherHolder],
    },
    {
      provide: ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY,
      useFactory: (config: ReturnType<typeof readConfigFromEnv>) =>
        new AnonymousAuthenticationStrategyFactory(
          new FirebaseRestSessionGateway(config.firebaseWebApiKey)
        ),
      inject: [APP_CONFIG],
    },
  ],
})
export class AppModule {}

