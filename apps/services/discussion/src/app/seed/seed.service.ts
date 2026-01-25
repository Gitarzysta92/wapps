import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ContentNodeEntity } from '../discussions/infrastructure/content-node.entity';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';
import { Uuidv7 } from '@foundation/standard';
import { DiscussionsService } from '../discussions/discussions.service';
import { DISCUSSION_NODE_KIND } from '@domains/discussion';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(ContentNodeEntity)
    private contentNodeRepo: Repository<ContentNodeEntity>,
    private readonly discussionsService: DiscussionsService,
  ) {}

  async seed() {
    try {
      const totalNodes = await this.contentNodeRepo.count();
      this.logger.log(`🌱 Seed check: content_nodes count=${totalNodes}`);

      await this.seedSystemNodes();
      await this.seedDemoDiscussionIfEnabled();

      this.logger.log('✅ Seeding completed');
    } catch (error) {
      this.logger.error('❌ Error during seeding:', error);
    }
  }

  private async seedSystemNodes() {
    this.logger.log('Seeding system content nodes...');
    const timestamp = Date.now();

    const existingSystemNode = await this.contentNodeRepo.findOne({ where: { kind: 'system' } });
    if (existingSystemNode) {
      this.logger.log('✅ System node already present, skipping...');
      return;
    }

    const systemNode = this.contentNodeRepo.create({
      id: uuidv7() as Uuidv7,
      referenceKey: uuidv7() as Uuidv7,
      kind: 'system',
      state: ContentNodeState.PUBLISHED,
      visibility: ContentNodeVisibility.PUBLIC,
      createdAt: timestamp,
    });

    await this.contentNodeRepo.save(systemNode);
    this.logger.log('✅ Seeded system content node');
  }

  private async seedDemoDiscussionIfEnabled() {
    const enabled = (process.env.DISCUSSION_SEED_DEMO_DATA || '').toLowerCase() === 'true';
    if (!enabled) {
      return;
    }

    const existingDiscussions = await this.contentNodeRepo.count({ where: { kind: DISCUSSION_NODE_KIND } });
    if (existingDiscussions > 0) {
      this.logger.log(`✅ Demo seed skipped (existing discussions=${existingDiscussions})`);
      return;
    }

    this.logger.log('🌱 Seeding demo discussion payload...');

    const payload = {
      content: {
        type: 'demo',
        title: 'Seeded discussion',
        text: 'This discussion was seeded on startup. Set DISCUSSION_SEED_DEMO_DATA=false to disable.',
      },
    };

    const ctx = {
      identityId: 'seed',
      tenantId: 'default',
      timestamp: Date.now(),
    };

    const result = await this.discussionsService.create(payload, ctx);
    if ('error' in (result as any)) {
      // Result<..., Error> from @foundation/standard
      this.logger.error('❌ Demo discussion seed failed', (result as any).error);
      return;
    }

    this.logger.log('✅ Seeded demo discussion');
  }
}
