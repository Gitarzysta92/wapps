import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FirebaseRegistration1792454400000 } from '@sdk/extras/identity-firebase';
import {
  LocalCredentials1792281600000,
  LocalEnrollment1792281602000,
} from '@sdk/extras/identity-local';
import {
  CREDENTIAL_ADAPTERS,
  createCredentialAdapters,
} from './credential-providers';
import { validateAuthenticatorEnv } from './config/env.validation';
import { HealthController } from './controllers/health.controller';
import { PlatformController } from './controllers/platform.controller';
import { CredentialController } from './credential.controller';
import { assertCredentialDatabase } from './credential-data-source';

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
        host: config.getOrThrow<string>('MYSQL_HOST'),
        port: Number(config.getOrThrow<string>('MYSQL_PORT')),
        username: config.getOrThrow<string>('MYSQL_USERNAME'),
        password: config.getOrThrow<string>('MYSQL_PASSWORD'),
        database: config.getOrThrow<string>('MYSQL_DATABASE'),
        entities: [],
        synchronize: false,
        migrationsRun: false,
        migrationsTransactionMode: 'none',
        migrations: [
          LocalCredentials1792281600000,
          LocalEnrollment1792281602000,
          FirebaseRegistration1792454400000,
        ],
        logging: false,
      }),
    }),
  ],
  controllers: [HealthController, PlatformController, CredentialController],
  providers: [
    {
      provide: CREDENTIAL_ADAPTERS,
      inject: [ConfigService, DataSource],
      useFactory: async (config: ConfigService, source: DataSource) => {
        await assertCredentialDatabase(source);
        if (await source.showMigrations())
          throw new Error('Run authentication --migrate before startup');
        return createCredentialAdapters(config, source);
      },
    },
  ],
})
export class AppModule {}
