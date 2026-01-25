import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health/health.controller';

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
        host: configService.get('CONTENT_NODE_REGISTRY_DATABASE_HOST') || 'localhost',
        port: parseInt(configService.get('CONTENT_NODE_REGISTRY_DATABASE_PORT') || '3306', 10),
        username: configService.get('CONTENT_NODE_REGISTRY_DATABASE_USERNAME') || 'root',
        password: configService.get('CONTENT_NODE_REGISTRY_DATABASE_PASSWORD') || 'password',
        database: configService.get('CONTENT_NODE_REGISTRY_DATABASE_NAME') || 'content_node_registry',
        entities: [
          
        ],
        schema: 'content_node_registry',
        synchronize: true,
        logging: false,
      }),
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
