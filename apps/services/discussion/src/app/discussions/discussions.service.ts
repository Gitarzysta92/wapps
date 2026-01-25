import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionCreationDto, DiscussionService } from '@domains/discussion';
import { AuthorityValidationService } from '@foundation/authority-system';
import { Result, isErr } from '@foundation/standard';
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
  private payloadRepository: MinioDiscussionPayloadRepository;

  constructor(
    @InjectRepository(Discussion)
    private discussionsRepository: Repository<Discussion>,
    minioClient: MinioClient,
    @Inject('DISCUSSION_QUEUE') queue: QueueChannel,
    contentNodeRepository: MysqlContentNodeRepository
  ) {
    const authorityValidationService: AuthorityValidationService = new (class extends AuthorityValidationService {})(new AllowAllPolicyEvaluator());
    this.payloadRepository = new MinioDiscussionPayloadRepository(minioClient);
    const discussionPayloadRepository: IDiscussionPayloadRepository = this.payloadRepository;
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

  async findAll(): Promise<unknown[]> {
    const result = await this.payloadRepository.listAllPayloads<unknown>();
    if (isErr(result)) {
      throw result.error;
    }
    return result.value;
  }

  async findOne(id: string): Promise<unknown> {
    const result = await this.payloadRepository.getPayload<unknown>(id);
    if (isErr(result)) {
      throw result.error;
    }
    return result.value;
  }

  async update(id: string, data: Partial<Discussion>): Promise<{ updated: true }> {
    const result = await this.payloadRepository.updatePayload(id, data as unknown as Record<string, unknown>);
    if (isErr(result)) {
      throw result.error;
    }
    return { updated: true };
  }


  create(
    data: DiscussionCreationDto,
    ctx: CommentCreationContext
  ): Promise<Result<boolean, Error>> {
    return this.discussionService.addDiscussion(data, ctx);
  }

  async remove(id: string) {
    await this.discussionsRepository.delete(id);
    return { deleted: true };
  }
}
