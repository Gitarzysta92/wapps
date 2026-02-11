import { Module } from '@nestjs/common';
import { IdentityAuthenticationServiceV2 } from '@domains/identity/authentication';
import { FirebaseAdminIdTokenVerifier, FirebaseAdminUserProvisioner, FirebaseRestSessionGateway, OAuthCodeExchanger } from '@infrastructure/firebase-identity';
import { APP_CONFIG, IDENTITY_AUTH_SERVICE, SWAGGER_DOCUMENT } from './tokens';
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
      provide: IDENTITY_AUTH_SERVICE,
      useFactory: (
        config: ReturnType<typeof readConfigFromEnv>,
        graphHolder: IdentityGraphProvisionerHolder,
        eventsHolder: IdentityEventsPublisherHolder
      ) => {
        return new IdentityAuthenticationServiceV2(
          new FirebaseAdminIdTokenVerifier(),
          new FirebaseRestSessionGateway(config.firebaseWebApiKey),
          new FirebaseAdminUserProvisioner(),
          new OAuthCodeExchanger({
            googleClientId: config.oauth.googleClientId,
            googleClientSecret: config.oauth.googleClientSecret,
            githubClientId: config.oauth.githubClientId,
            githubClientSecret: config.oauth.githubClientSecret,
          }),
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
      inject: [APP_CONFIG, IdentityGraphProvisionerHolder, IdentityEventsPublisherHolder],
    },
  ],
})
export class AppModule {}

