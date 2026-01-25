import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DiscussionsModule } from './discussions/discussions.module';
import { Discussion } from './discussions/entities/discussion.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DISCUSSION_DATABASE_HOST') || 'localhost',
        port: parseInt(configService.get('DISCUSSION_DATABASE_PORT') || '3306', 10),
        username: configService.get('DISCUSSION_DATABASE_USERNAME') || 'root',
        password: configService.get('DISCUSSION_DATABASE_PASSWORD') || 'password',
        database: configService.get('DISCUSSION_DATABASE_NAME') || 'discussion',
        entities: [Discussion],
        synchronize: true, // Auto-create tables (disable in production)
        logging: false,
      }),
    }),
    DiscussionsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
