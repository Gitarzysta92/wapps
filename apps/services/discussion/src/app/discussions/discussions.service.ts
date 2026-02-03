import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DISCUSSION_NODE_KIND, DiscussionCreationDto, DiscussionService } from '@domains/discussion';
import { AuthorityValidationService } from '@foundation/authority-system';
import { Result, Uuidv7, isErr } from '@foundation/standard';
import { IDiscussionPayloadRepository } from '@domains/discussion';
import { IDiscussionProjectionService } from '@domains/discussion';
import { IDiscussionIdentificatorGenerator, CommentCreationContext } from '@domains/discussion';
import { MinioClient } from '../infrastructure/minio-client';
import { QueueChannel } from '@infrastructure/platform-queue';
import { AllowAllPolicyEvaluator } from './infrastructure/allow-all-policy-evaluator';
import { MinioDiscussionPayloadRepository } from './infrastructure/minio-discussion-payload.repository';
import { MysqlContentNodeRepository } from './infrastructure/mysql-content-node.repository';
import { RabbitMqDiscussionProjectionService } from './infrastructure/rabbitmq-discussion-projection.service';
import { CryptoDiscussionIdentificatorGenerator } from './infrastructure/discussion-identificator.generator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentLikeEntity } from './infrastructure/comment-like.entity';

@Injectable()
export class DiscussionsService {
  private discussionService: DiscussionService;
  private payloadRepository: MinioDiscussionPayloadRepository;
  private readonly contentNodeRepository: MysqlContentNodeRepository;
  private readonly authorityValidationService: AuthorityValidationService;

  constructor(
    minioClient: MinioClient,
    @Inject('DISCUSSION_QUEUE') queue: QueueChannel,
    contentNodeRepository: MysqlContentNodeRepository,
    @InjectRepository(CommentLikeEntity)
    private readonly commentLikes: Repository<CommentLikeEntity>
  ) {
    this.contentNodeRepository = contentNodeRepository;
    this.authorityValidationService = new (class extends AuthorityValidationService {})(new AllowAllPolicyEvaluator());
    this.payloadRepository = new MinioDiscussionPayloadRepository(minioClient);
    const discussionPayloadRepository: IDiscussionPayloadRepository = this.payloadRepository;
    const discussionProjectionService: IDiscussionProjectionService = new RabbitMqDiscussionProjectionService(queue);
    const identificatorGenerator: IDiscussionIdentificatorGenerator = new CryptoDiscussionIdentificatorGenerator();

    this.discussionService = new DiscussionService(
      contentNodeRepository,
      this.authorityValidationService,
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

  async countDiscussions(): Promise<number> {
    const result = await this.contentNodeRepository.getNodesByKind(DISCUSSION_NODE_KIND);
    if (isErr(result)) {
      throw result.error;
    }
    return result.value.length;
  }

  async update(id: string, patch: Record<string, unknown>): Promise<{ updated: true }> {
    const result = await this.payloadRepository.updatePayload(id, patch);
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

  async likeComment(commentId: string, ctx: CommentCreationContext): Promise<{ liked: true }> {
    const auth = await this.authorityValidationService.validate({
      identityId: ctx.identityId,
      tenantId: ctx.tenantId,
      timestamp: ctx.timestamp,
      actionName: 'discussion.comment.like',
    });
    if (isErr(auth)) throw auth.error;
    if (auth.value !== true) throw new UnauthorizedException('Not allowed to like comment');

    // Idempotent by unique index (commentId, actorIdentityId).
    await this.commentLikes
      .createQueryBuilder()
      .insert()
      .values({
        commentId,
        actorIdentityId: ctx.identityId,
        createdAt: Date.now(),
      })
      // MySQL syntax; TypeORM will translate for supported drivers.
      .orIgnore()
      .execute();

    return { liked: true };
  }

  async unlikeComment(commentId: string, ctx: CommentCreationContext): Promise<{ unliked: true }> {
    const auth = await this.authorityValidationService.validate({
      identityId: ctx.identityId,
      tenantId: ctx.tenantId,
      timestamp: ctx.timestamp,
      actionName: 'discussion.comment.unlike',
    });
    if (isErr(auth)) throw auth.error;
    if (auth.value !== true) throw new UnauthorizedException('Not allowed to unlike comment');

    await this.commentLikes.delete({
      commentId,
      actorIdentityId: ctx.identityId,
    });
    return { unliked: true };
  }

  async remove(id: string) {
    const payloadResult = await this.payloadRepository.deletePayload(id);
    if (isErr(payloadResult)) {
      throw payloadResult.error;
    }

    const nodeResult = await this.contentNodeRepository.getNode(id as unknown as Uuidv7);
    if (isErr(nodeResult)) {
      throw nodeResult.error;
    }

    const deleteNodeResult = await this.contentNodeRepository.deleteNode(nodeResult.value);
    if (isErr(deleteNodeResult)) {
      throw deleteNodeResult.error;
    }

    return { deleted: true };
  }
}
