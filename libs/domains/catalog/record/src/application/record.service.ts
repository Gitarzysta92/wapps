import { IContentNodeRepository } from "@foundation/content-system";
import { AuthorityValidationService, IAuthorityValidationContext } from "@foundation/authority-system";
import { IOperationContext } from "@foundation/workflow-system";
import { err, isErr, Result } from "@foundation/standard";
import {
  RECORD_NODE_KIND,
  CATEGORIZED_RELATION_TYPE,
  TAGGED_RELATION_TYPE,
  SUPPORTED_PLATFORM_RELATION_TYPE,
  DEFAULT_CONTENT_NODE_VISIBILITY,
  DEFAULT_CONTENT_NODE_STATE,
  CREATE_RECORD_ACTION_NAME
} from "./constants";
import { IRecordProjectionService } from "./ports/record-projection-service.port";
import { IRecordIdentificatorGenerator } from "./ports/record-identificatior-generator.port";
import { RecordCreationDto } from "./models/record-creation.dto";


export abstract class RecordService {
  constructor(
    private readonly contentSystemRepository: IContentNodeRepository,
    private readonly authorityValidationService: AuthorityValidationService,
    private readonly recordProjectionService: IRecordProjectionService,
    private readonly identificatorGenerator: IRecordIdentificatorGenerator
  ) { }

  async addRecord(
    payload: RecordCreationDto,
    ctx: IOperationContext & IAuthorityValidationContext
  ): Promise<Result<boolean, Error>> {
    const validatableContext = {
      identityId: ctx.identityId,
      tenantId: ctx.tenantId,
      timestamp: ctx.timestamp,
      actionName: CREATE_RECORD_ACTION_NAME,
    };

    const authorityValidationResult = await this.authorityValidationService.validate(validatableContext);
    if (isErr(authorityValidationResult)) {
      return err<Error>(authorityValidationResult.error);
    }

    const recordId = this.identificatorGenerator.generate();
    const timestamp = Date.now();
    const result = await this.contentSystemRepository.addNode({
      id: recordId,
      referenceKey: this.identificatorGenerator.generate(),
      kind: RECORD_NODE_KIND,
      state: payload.state || DEFAULT_CONTENT_NODE_STATE,
      visibility: payload.visibility || DEFAULT_CONTENT_NODE_VISIBILITY,
      createdAt: timestamp,
    },
    [
      ...payload.tagIds.map(tagId => ({
        id: this.identificatorGenerator.generate(),
        fromContentId: recordId,
        toContentId: tagId,
        relationType: TAGGED_RELATION_TYPE,
        createdAt: timestamp,
      })),
      {
        id: this.identificatorGenerator.generate(),
        fromContentId: recordId,
        toContentId: payload.categoryId,
        relationType: CATEGORIZED_RELATION_TYPE,
        createdAt: timestamp,
      },
      ...payload.platformIds.map(platformId => ({
        id: this.identificatorGenerator.generate(),
        fromContentId: recordId,
        toContentId: platformId,
        relationType: SUPPORTED_PLATFORM_RELATION_TYPE,
        createdAt: timestamp,
      })),
    ]);

    this.recordProjectionService.requestMaterialization(recordId);
    return result;
  }
}
