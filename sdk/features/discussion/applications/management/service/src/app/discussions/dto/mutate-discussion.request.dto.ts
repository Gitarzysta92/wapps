import {
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  ContentNodeState,
  ContentNodeVisibility,
} from '@sdk/kernel/ontology/content';

export class CreateCommentRequestDto {
  @IsDefined()
  content!: unknown;
}

export class DeleteDiscussionRequestDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedRevision!: number;
}

export class UpdateDiscussionRequestDto extends DeleteDiscussionRequestDto {
  @IsDefined()
  content!: unknown;

  @IsOptional()
  @IsEnum(ContentNodeState)
  state?: ContentNodeState;

  @IsOptional()
  @IsEnum(ContentNodeVisibility)
  visibility?: ContentNodeVisibility;
}
