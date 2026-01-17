import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { SeedService } from './seed/seed.service';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { AppsModule } from './apps/apps.module';
import { ReferenceModule } from './reference/reference.module';

// Import entities
import { Category } from './categories/entities/category.entity';
import { Tag } from './tags/entities/tag.entity';
import { AppRecord } from './apps/entities/app-record.entity';
import { Platform } from './reference/entities/platform.entity';
import { Device } from './reference/entities/device.entity';
import { Social } from './reference/entities/social.entity';
import { Store } from './reference/entities/store.entity';
import { MonetizationModel } from './reference/entities/monetization-model.entity';
import { UserSpan } from './reference/entities/user-span.entity';

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
        url: configService.get('DATABASE_URL') || 'mysql://root:password@localhost:3306/editorial',
        entities: [
          Category,
          Tag,
          AppRecord,
          Platform,
          Device,
          Social,
          Store,
          MonetizationModel,
          UserSpan,
        ],
        synchronize: true, // Auto-create tables (disable in production)
        logging: false,
      }),
    }),
    CategoriesModule,
    TagsModule,
    AppsModule,
    ReferenceModule,
  ],
  controllers: [HealthController],
  providers: [SeedService],
})
export class AppModule implements OnModuleInit {
  constructor(private seedService: SeedService) {}

  async onModuleInit() {
    // Seed data on startup
    await this.seedService.seed();
  }
}
