import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DiscussionsModule } from './discussions/discussions.module';
import { Discussion } from './discussions/entities/discussion.entity';
import { AuthValidationMiddleware } from './middleware/auth-validation.middleware';
import { ContentNodeEntity } from './discussions/infrastructure/content-node.entity';
import { ContentNodeRelationEntity } from './discussions/infrastructure/content-node-relation.entity';

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
        entities: [Discussion, ContentNodeEntity, ContentNodeRelationEntity],
        synchronize: true, // Auto-create tables (disable in production)
        logging: false,
      }),
    }),
    DiscussionsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthValidationMiddleware).forRoutes('*');
  }
}
