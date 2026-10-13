import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  ParseUUIDPipe,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { CreateDiscussionRequestDto } from './dto/create-discussion.request.dto';
import {
  CreateCommentRequestDto,
  DeleteDiscussionRequestDto,
  UpdateDiscussionRequestDto,
} from './dto/mutate-discussion.request.dto';
import { DiscussionActor } from './application/discussion-write.port';
import { DiscussionErrorFilter } from './discussion-error.filter';

export function discussionActor(
  user: AuthenticatedUser
): DiscussionActor | null {
  if (!user.userId || user.isAnonymous) return null;
  const tenant =
    user.userClaims?.tenantId ??
    process.env.DISCUSSION_PUBLIC_TENANT ??
    'default';
  const roles = user.userClaims?.roles ?? [];
  if (
    typeof tenant !== 'string' ||
    !tenant ||
    tenant.length > 128 ||
    !Array.isArray(roles) ||
    roles.length > 64 ||
    !roles.every((role) => typeof role === 'string' && role.length <= 128)
  )
    throw new BadRequestException('Invalid actor scope');
  return { identityId: user.userId, tenantId: tenant, roles };
}

export function requiredActor(user: AuthenticatedUser): DiscussionActor {
  const actor = discussionActor(user);
  if (!actor) throw new BadRequestException('Authenticated actor required');
  return actor;
}

@ApiTags('discussions')
@UseFilters(DiscussionErrorFilter)
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Get()
  findAll(@AuthUser({ optional: true }) user: AuthenticatedUser) {
    return this.discussions.findAll(discussionActor(user));
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.discussions.findOne(id, discussionActor(user));
  }

  @Post()
  @ApiOperation({
    summary: 'Commit a discussion; materialization is asynchronous',
  })
  @ApiBody({ type: CreateDiscussionRequestDto })
  create(
    @Body() data: CreateDiscussionRequestDto,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.create(data, requiredActor(user), key);
  }

  @Post(':id/comments')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CreateCommentRequestDto,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.reply(id, data.content, requiredActor(user), key);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateDiscussionRequestDto,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.update(id, data, requiredActor(user), key);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: DeleteDiscussionRequestDto,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.remove(
      id,
      data.expectedRevision,
      requiredActor(user),
      key
    );
  }

  @Post('comments/:id/like')
  likeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.likeComment(id, requiredActor(user), key);
  }

  @Delete('comments/:id/like')
  unlikeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.unlikeComment(id, requiredActor(user), key);
  }
}
