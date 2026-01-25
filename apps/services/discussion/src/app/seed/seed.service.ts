import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ContentNodeEntity } from '../discussions/infrastructure/content-node.entity';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';
import { Uuidv7 } from '@foundation/standard';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(ContentNodeEntity)
    private contentNodeRepo: Repository<ContentNodeEntity>,
  ) {}

  async seed() {
    try {
      // Check if already seeded
      const count = await this.contentNodeRepo.count();
      if (count > 0) {
        this.logger.log('✅ Database already seeded, skipping...');
        return;
      }

      this.logger.log('🌱 Starting data seeding...');

      await this.seedSystemNodes();

      this.logger.log('✅ Data seeding completed successfully!');
    } catch (error) {
      this.logger.error('❌ Error during seeding:', error);
    }
  }

  private async seedSystemNodes() {
    this.logger.log('Seeding system content nodes...');
    const timestamp = Date.now();

    // Seed a root system node for discussions
    const systemNode = this.contentNodeRepo.create({
      id: uuidv7() as Uuidv7,
      referenceKey: uuidv7() as Uuidv7,
      kind: 'system',
      state: ContentNodeState.PUBLISHED,
      visibility: ContentNodeVisibility.PUBLIC,
      createdAt: timestamp,
    });

    await this.contentNodeRepo.save(systemNode);
    this.logger.log('✅ Seeded system content nodes');
  }
}
