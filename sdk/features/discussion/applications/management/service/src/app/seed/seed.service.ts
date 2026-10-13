import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v5 as uuidv5 } from 'uuid';
import { ContentNodeEntity } from '../discussions/infrastructure/content-node.entity';
import {
  ContentNodeState,
  ContentNodeVisibility,
} from '@sdk/kernel/ontology/content';
import { Uuidv7 } from '@sdk/kernel/standard';
import { DiscussionsService } from '../discussions/discussions.service';
import { categories, tags } from '@data';
import { CategoryTreeDto } from '@domains/catalog/category';
import { TagOptionDto } from '@domains/catalog/tags';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(ContentNodeEntity)
    private contentNodeRepo: Repository<ContentNodeEntity>,
    private readonly discussionsService: DiscussionsService
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
    const systemNode = this.contentNodeRepo.create({
      id: this.buildSeedUuid('system-node'),
      referenceKey: this.buildSeedUuid('system-node-ref'),
      kind: 'system',
      state: ContentNodeState.PUBLISHED,
      visibility: ContentNodeVisibility.PUBLIC,
      createdAt: timestamp,
    });

    await this.contentNodeRepo.upsert(systemNode, ['id']);
    this.logger.log('✅ Seeded system content node');
  }

  private async seedDemoDiscussionIfEnabled() {
    const enabled =
      (process.env.DISCUSSION_SEED_DEMO_DATA || '').toLowerCase() === 'true';
    if (!enabled) {
      return;
    }

    this.logger.log('🌱 Seeding demo discussion payload...');

    const seedContent = this.buildSeedContent();
    const payload = {
      content: seedContent,
    };

    const ctx = {
      identityId: 'seed',
      tenantId: 'default',
      roles: ['discussion:writer'],
    };

    await this.discussionsService.create(payload, ctx, 'demo-discussion-v2');

    this.logger.log('✅ Seeded demo discussion');
  }

  private buildSeedContent(): Record<string, unknown> {
    const fallbackTags: TagOptionDto[] = [
      { id: 0, name: 'Discussion', slug: 'discussion' },
      { id: 1, name: 'Community', slug: 'community' },
      { id: 2, name: 'Feedback', slug: 'feedback' },
    ];
    const fallbackCategories: CategoryTreeDto[] = [
      { id: 0, slug: 'general', name: 'General', childs: [] },
    ];

    const availableTags =
      Array.isArray(tags) && tags.length > 0 ? tags : fallbackTags;
    const availableCategories =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : fallbackCategories;

    const leafCategories = this.flattenCategories(availableCategories);
    const selectedCategory = leafCategories[0] ?? fallbackCategories[0];
    const selectedTags = availableTags.slice(0, 3);

    return {
      type: 'seed',
      title: `Seeded discussion: ${selectedCategory.name}`,
      text: 'This discussion was seeded from @data. Set DISCUSSION_SEED_DEMO_DATA=false to disable.',
      category: {
        id: selectedCategory.id,
        slug: selectedCategory.slug,
        name: selectedCategory.name,
      },
      tags: selectedTags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
      })),
    };
  }

  private flattenCategories(
    nodes: CategoryTreeDto[]
  ): Array<Pick<CategoryTreeDto, 'id' | 'slug' | 'name'>> {
    const result: Array<Pick<CategoryTreeDto, 'id' | 'slug' | 'name'>> = [];
    for (const node of nodes) {
      if (Array.isArray(node.childs) && node.childs.length > 0) {
        result.push(...this.flattenCategories(node.childs));
      } else {
        result.push({ id: node.id, slug: node.slug, name: node.name });
      }
    }
    return result;
  }

  private buildSeedUuid(name: string): Uuidv7 {
    return uuidv5(`discussion:${name}`, uuidv5.DNS) as Uuidv7;
  }
}
