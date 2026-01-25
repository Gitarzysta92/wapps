import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';
import { Discussion } from './entities/discussion.entity';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { CreateDiscussionRequestDto } from './dto/create-discussion.request.dto';

@ApiTags('discussions')
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all discussions' })
  findAll() {
    return this.discussionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discussion by ID' })
  findOne(@Param('id') id: string) {
    return this.discussionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new discussion' })
  @ApiBody({ type: CreateDiscussionRequestDto })
  @ApiHeader({ name: 'x-user-id', required: false, description: 'Authenticated user id (set by ingress)' })
  @ApiHeader({ name: 'x-anonymous', required: false, description: 'Set to true to act as anonymous (set by ingress)' })
  @ApiHeader({ name: 'x-ingress-auth', required: false, description: 'Ingress auth secret for user headers (set by ingress)' })
  create(@Body() data: CreateDiscussionRequestDto, @AuthUser({ optional: true }) user: AuthenticatedUser) {
    const tenantId = (user.userClaims?.tenantId as string | undefined) ?? 'default';
    const ctx = {
      identityId: user.userId ?? 'anonymous',
      tenantId,
      timestamp: Date.now(),
    };

    return this.discussionsService.create(data, ctx);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update discussion' })
  update(@Param('id') id: string, @Body() data: Partial<Discussion>) {
    return this.discussionsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete discussion' })
  remove(@Param('id') id: string) {
    return this.discussionsService.remove(id);
  }
}
