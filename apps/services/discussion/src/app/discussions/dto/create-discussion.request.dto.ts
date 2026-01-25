import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContentNodeState, ContentNodeVisibility } from '@foundation/content-system';
import { Uuidv7 } from '@foundation/standard';

export class CreateDiscussionRequestDto {
  @ApiProperty({
    description: 'Discussion body content. Stored as payload (e.g. MinIO).',
    type: 'object',
    example: { blocks: [{ type: 'paragraph', text: 'Hello world' }] },
  })
  @IsDefined()
  content!: unknown;

  @ApiPropertyOptional({
    description: 'Optional content node this discussion is about.',
    type: 'string',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  subjectId?: Uuidv7;

  @ApiPropertyOptional({ enum: ContentNodeState })
  @IsOptional()
  @IsEnum(ContentNodeState)
  state?: ContentNodeState;

  @ApiPropertyOptional({ enum: ContentNodeVisibility })
  @IsOptional()
  @IsEnum(ContentNodeVisibility)
  visibility?: ContentNodeVisibility;
}

