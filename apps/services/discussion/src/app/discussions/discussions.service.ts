import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionCreationDto, DiscussionService } from '@domains/discussion';
import { AuthorityValidationService } from '@foundation/authority-system';
import { Result } from '@foundation/standard';
import { IDiscussionPayloadRepository } from '@domains/discussion';
import { IDiscussionProjectionService } from '@domains/discussion';
import { IDiscussionIdentificatorGenerator, CommentCreationContext } from '@domains/discussion';
import { MinioClient } from '../infrastructure/minio-client';
import { QueueChannel } from '../infrastructure/queue-client';
import { AllowAllPolicyEvaluator } from './infrastructure/allow-all-policy-evaluator';
import { MinioDiscussionPayloadRepository } from './infrastructure/minio-discussion-payload.repository';
import { MysqlContentNodeRepository } from './infrastructure/mysql-content-node.repository';
import { RabbitMqDiscussionProjectionService } from './infrastructure/rabbitmq-discussion-projection.service';
import { CryptoDiscussionIdentificatorGenerator } from './infrastructure/discussion-identificator.generator';

@Injectable()
export class DiscussionsService {
  private discussionService: DiscussionService;

  constructor(
    @InjectRepository(Discussion)
    private discussionsRepository: Repository<Discussion>,
    minioClient: MinioClient,
    @Inject('DISCUSSION_QUEUE') queue: QueueChannel,
    contentNodeRepository: MysqlContentNodeRepository
  ) {
    const authorityValidationService: AuthorityValidationService = new (class extends AuthorityValidationService {})(new AllowAllPolicyEvaluator());
    const discussionPayloadRepository: IDiscussionPayloadRepository = new MinioDiscussionPayloadRepository(minioClient);
    const discussionProjectionService: IDiscussionProjectionService = new RabbitMqDiscussionProjectionService(queue);
    const identificatorGenerator: IDiscussionIdentificatorGenerator = new CryptoDiscussionIdentificatorGenerator();

    this.discussionService = new DiscussionService(
      contentNodeRepository,
      authorityValidationService,
      discussionPayloadRepository,
      discussionProjectionService,
      identificatorGenerator,
    );
  }

  findAll() {
    return this.discussionsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string) {
    return this.discussionsRepository.findOne({
      where: { id },
    });
  }

  create(
    data: DiscussionCreationDto,
    ctx: CommentCreationContext
  ): Promise<Result<boolean, Error>> {
    return this.discussionService.addDiscussion(data, ctx);
  }

  async update(id: string, data: Partial<Discussion>) {
    await this.discussionsRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.discussionsRepository.delete(id);
    return { deleted: true };
  }
}
