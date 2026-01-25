import { IContentNodeRepository } from '@foundation/content-system';
import {
  AuthorityValidationService,
  IAuthorityValidationContext,
} from '@foundation/authority-system';
import { IOperationContext } from '@foundation/workflow-system';
import { err, isErr, Result } from '@foundation/standard';
import {
  DISCUSSION_NODE_KIND,
  COMMENT_NODE_KIND,
  DISCUSSES_RELATION_TYPE,
  DEFAULT_CONTENT_NODE_VISIBILITY,
  DEFAULT_CONTENT_NODE_STATE,
  CREATE_DISCUSSION_ACTION_NAME,
  CREATE_COMMENT_ACTION_NAME,
  REPLIES_RELATION_TYPE,
} from './constants';
import { IDiscussionProjectionService } from './ports/discussion-projection-service.port';
import { IDiscussionIdentificatorGenerator } from './ports/discussion-identificator-generator.port';
import { DiscussionCreationDto } from './models/discussion-creation.dto';
import { CommentCreationDto } from './models/comment-creation.dto'
import { IDiscussionPayloadRepository } from './ports/discussion-payload-repository.port';

export class DiscussionService {
  constructor(
    private readonly contentNodeRepository: IContentNodeRepository,
    private readonly authorityValidationService: AuthorityValidationService,
    private readonly discussionPayloadRepository: IDiscussionPayloadRepository,
    private readonly discussionProjectionService: IDiscussionProjectionService,
    private readonly identificatorGenerator: IDiscussionIdentificatorGenerator
  ) { }
  
  async addComment(
    payload: CommentCreationDto,
    ctx: IOperationContext & IAuthorityValidationContext
  ): Promise<Result<boolean, Error>> {
    const timestamp = Date.now();

    const authorityContext = Object.assign({
      actionName: CREATE_COMMENT_ACTION_NAME,
    }, ctx);

    const authorityValidationResult =
      await this.authorityValidationService.validate(authorityContext);
    if (isErr(authorityValidationResult)) {
      return err<Error>(authorityValidationResult.error);
    }

    const commentId = this.identificatorGenerator.generate();
    let result = await this.contentNodeRepository.addNode(
      {
        id: commentId,
        referenceKey: this.identificatorGenerator.generate(),
        kind: COMMENT_NODE_KIND,
        state: payload.state || DEFAULT_CONTENT_NODE_STATE,
        visibility: payload.visibility || DEFAULT_CONTENT_NODE_VISIBILITY,
        createdAt: timestamp,
      },
      [
        {
          id: this.identificatorGenerator.generate(),
          fromContentId: commentId,
          toContentId: payload.subjectId,
          relationType: REPLIES_RELATION_TYPE,
          createdAt: timestamp,
        },
      ]
    );

    if (isErr(result)) {
      return result;
    }

    result = await this.discussionPayloadRepository.addPayload(commentId, payload);
    if (isErr(result)) {
      return result;
    }

    this.discussionProjectionService.requestMaterialization(commentId);
    return result;
  }



  async addDiscussion(
    payload: DiscussionCreationDto,
    ctx: IOperationContext & IAuthorityValidationContext
  ): Promise<Result<boolean, Error>> {
    const authorityContext = Object.assign({
      actionName: CREATE_DISCUSSION_ACTION_NAME,
    }, ctx);

    const authorityValidationResult =
      await this.authorityValidationService.validate(authorityContext);
    if (isErr(authorityValidationResult)) {
      return err<Error>(authorityValidationResult.error);
    }

    const discussionId = this.identificatorGenerator.generate();
    const timestamp = Date.now();
    const result = await this.contentNodeRepository.addNode(
      {
        id: discussionId,
        referenceKey: this.identificatorGenerator.generate(),
        kind: DISCUSSION_NODE_KIND,
        state: payload.state || DEFAULT_CONTENT_NODE_STATE,
        visibility: payload.visibility || DEFAULT_CONTENT_NODE_VISIBILITY,
        createdAt: timestamp,
      },
      !payload.subjectId ? [] :
      [
        {
          id: this.identificatorGenerator.generate(),
          fromContentId: discussionId,
          toContentId: payload.subjectId,
          relationType: DISCUSSES_RELATION_TYPE,
          createdAt: timestamp,
        },
      ]
    );
    return result;
  }
}
