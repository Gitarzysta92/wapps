import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { Platform, Device, Social, Store, MonetizationModel, UserSpan } from '../reference/entities/index';

// ✅ THIS WORKS! Import from @data using TypeScript path aliases
import { categories, tags, platforms, devices, socials, stores, monetizationModels, userSpans } from '@data';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Category) private categoriesRepo: Repository<Category>,
    @InjectRepository(Tag) private tagsRepo: Repository<Tag>,
    @InjectRepository(Platform) private platformsRepo: Repository<Platform>,
    @InjectRepository(Device) private devicesRepo: Repository<Device>,
    @InjectRepository(Social) private socialsRepo: Repository<Social>,
    @InjectRepository(Store) private storesRepo: Repository<Store>,
    @InjectRepository(MonetizationModel) private monetizationRepo: Repository<MonetizationModel>,
    @InjectRepository(UserSpan) private userSpansRepo: Repository<UserSpan>,
  ) {}

  async seed() {
    try {
      // Check if already seeded
      const count = await this.categoriesRepo.count();
      if (count > 0) {
        this.logger.log('✅ Database already seeded, skipping...');
        return;
      }

      this.logger.log('🌱 Starting data seeding...');

      await this.seedPlatforms();
      await this.seedDevices();
      await this.seedSocials();
      await this.seedStores();
      await this.seedMonetizationModels();
      await this.seedUserSpans();
      await this.seedCategories();
      await this.seedTags();

      this.logger.log('✅ Data seeding completed successfully!');
    } catch (error) {
      this.logger.error('❌ Error during seeding:', error);
    }
  }

  private async seedCategories() {
    this.logger.log(`Seeding ${categories.length} categories...`);
    const categoryMap = new Map<number, Category>();

    // Create parent categories
    for (const cat of categories) {
      const entity = this.categoriesRepo.create({
        name: cat.name,
        slug: cat.slug,
      });
      const saved = await this.categoriesRepo.save(entity);
      categoryMap.set(cat.id, saved);
    }

    // Create child categories
    for (const cat of categories) {
      if (cat.childs && cat.childs.length > 0) {
        const parent = categoryMap.get(cat.id);
        for (const child of cat.childs) {
          const childEntity = this.categoriesRepo.create({
            name: child.name,
            slug: child.slug,
            parent,
          });
          await this.categoriesRepo.save(childEntity);
        }
      }
    }
    this.logger.log(`✅ Seeded categories`);
  }

  private async seedTags() {
    this.logger.log(`Seeding ${tags.length} tags...`);
    for (const tag of tags) {
      await this.tagsRepo.save(this.tagsRepo.create({
        name: tag.name,
        slug: tag.slug,
      }));
    }
    this.logger.log(`✅ Seeded tags`);
  }

  private async seedPlatforms() {
    this.logger.log(`Seeding ${platforms.length} platforms...`);
    for (const platform of platforms) {
      await this.platformsRepo.save(this.platformsRepo.create({
        name: platform.name,
        slug: platform.slug,
      }));
    }
    this.logger.log(`✅ Seeded platforms`);
  }

  private async seedDevices() {
    this.logger.log(`Seeding ${devices.length} devices...`);
    for (const device of devices) {
      await this.devicesRepo.save(this.devicesRepo.create({
        name: device.name,
        slug: device.slug,
      }));
    }
    this.logger.log(`✅ Seeded devices`);
  }

  private async seedSocials() {
    this.logger.log(`Seeding ${socials.length} socials...`);
    for (const social of socials) {
      await this.socialsRepo.save(this.socialsRepo.create({
        name: social.name,
        slug: social.slug,
      }));
    }
    this.logger.log(`✅ Seeded socials`);
  }

  private async seedStores() {
    this.logger.log(`Seeding ${stores.length} stores...`);
    for (const store of stores) {
      await this.storesRepo.save(this.storesRepo.create({
        name: store.name,
        slug: store.slug,
      }));
    }
    this.logger.log(`✅ Seeded stores`);
  }

  private async seedMonetizationModels() {
    this.logger.log(`Seeding ${monetizationModels.length} monetization models...`);
    for (const model of monetizationModels) {
      await this.monetizationRepo.save(this.monetizationRepo.create({
        name: model.name,
        slug: model.slug,
      }));
    }
    this.logger.log(`✅ Seeded monetization models`);
  }

  private async seedUserSpans() {
    this.logger.log(`Seeding ${userSpans.length} user spans...`);
    for (const span of userSpans) {
      await this.userSpansRepo.save(this.userSpansRepo.create({
        name: span.name,
        slug: span.slug,
      }));
    }
    this.logger.log(`✅ Seeded user spans`);
  }
}
