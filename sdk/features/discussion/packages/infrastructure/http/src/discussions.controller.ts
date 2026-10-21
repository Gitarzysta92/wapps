import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import type { DiscussionActor } from '@sdk/features/discussion/libs/management';
import {
  DISCUSSION_HTTP_OPTIONS,
  type DiscussionHttpOptions,
} from './discussion-http.options';
import { DiscussionHttpFilter } from './discussion-http.filter';
import {
  discussionCreate,
  discussionDiscoveryInput,
  discussionEdit,
  discussionId,
  discussionObject,
  discussionQuery,
  discussionRevision,
  discussionScope,
} from './discussion-http.input';

@UseFilters(DiscussionHttpFilter)
@Controller('discussions')
export class DiscussionsController {
  constructor(
    @Inject(DISCUSSION_HTTP_OPTIONS)
    private readonly options: DiscussionHttpOptions
  ) {}

  @Get('participation')
  @Header('Cache-Control', 'no-store')
  participation(@Req() request: Request, @Query() input: unknown) {
    const query = discussionDiscoveryInput(input, false);
    return this.options.discovery.participation(
      this.actor(request),
      query.prefix,
      query.cursor,
      query.includeVotes
    );
  }

  @Get('selection')
  @Header('Cache-Control', 'no-store')
  selection(@Req() request: Request, @Query() input: unknown) {
    this.options.actor(request, false);
    const query = discussionDiscoveryInput(input, true);
    return this.options.discovery.selection(
      query.ids,
      query.prefix,
      query.includeVotes
    );
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: Request, @Query() input: unknown) {
    const query = discussionScope(input, 'list');
    const actor = this.options.actor(request, false);
    if (!query) return this.options.unboundQueries.findAll(actor);
    const result = await this.options.queries.list(
      query.bindingKey,
      actor,
      query.cursor,
      query.order,
      query.includeVotes
    );
    const last = result.next;
    return {
      items: result.items,
      next: last
        ? `${query.order === 'pinned' ? `${last.pinned ? 1 : 0}.` : ''}${
            last.at
          }.${last.id}`
        : null,
    };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown
  ) {
    const query = discussionScope(input, 'read');
    const actor = this.options.actor(request, false);
    if (!query)
      return this.options.unboundQueries.findOne(discussionId(id), actor);
    return this.options.queries.read(
      query.bindingKey,
      discussionId(id),
      actor,
      query.rootOnly,
      query.includeVotes
    );
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Req() request: Request,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const query = discussionScope(input, 'write');
    return this.options.commands.create(
      {
        ...discussionCreate(body),
        ...(query ? { bindingKey: query.bindingKey } : {}),
      },
      this.actor(request),
      key
    );
  }

  @Post(':id/comments')
  @Header('Cache-Control', 'no-store')
  reply(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const query = discussionScope(input, 'write');
    const row = discussionObject(body, ['content']);
    return this.options.commands.reply(
      discussionId(id),
      row.content,
      this.actor(request),
      key,
      query?.bindingKey
    );
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const query = discussionScope(input, 'write');
    return this.options.commands.update(
      discussionId(id),
      discussionEdit(body),
      this.actor(request),
      key,
      query?.bindingKey
    );
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const query = discussionScope(input, 'write');
    const row = discussionObject(body, ['expectedRevision']);
    return this.options.commands.remove(
      discussionId(id),
      discussionRevision(row.expectedRevision),
      this.actor(request),
      key,
      query?.bindingKey
    );
  }

  @Put(':id/vote')
  @Header('Cache-Control', 'no-store')
  vote(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const { bindingKey } = discussionQuery(input, 'write');
    return this.options.commands.vote(
      discussionId(id),
      body,
      this.actor(request),
      key,
      bindingKey
    );
  }

  @Put(':id/pin')
  @Header('Cache-Control', 'no-store')
  pin(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const { bindingKey } = discussionQuery(input, 'write');
    return this.options.commands.pin(
      discussionId(id),
      body,
      this.actor(request),
      key,
      bindingKey
    );
  }

  @Post('comments/:id/like')
  @Header('Cache-Control', 'no-store')
  like(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.changeLike(request, id, input, body, key, true);
  }

  @Delete('comments/:id/like')
  @Header('Cache-Control', 'no-store')
  unlike(
    @Req() request: Request,
    @Param('id') id: string,
    @Query() input: unknown,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.changeLike(request, id, input, body, key, false);
  }

  private changeLike(
    request: Request,
    id: string,
    input: unknown,
    body: unknown,
    key: string,
    liked: boolean
  ) {
    // Legacy likes apply only to unbound comments; bound votes have their own command.
    discussionObject(input, []);
    if (body !== undefined) discussionObject(body, []);
    return this.options.commands.like(
      discussionId(id),
      liked,
      this.actor(request),
      key
    );
  }

  private actor(request: Request): DiscussionActor {
    const actor = this.options.actor(request, true);
    if (!actor) throw new UnauthorizedException('Authentication required');
    return actor;
  }
}
