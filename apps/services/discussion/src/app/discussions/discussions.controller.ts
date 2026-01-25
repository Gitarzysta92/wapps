import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';
import { Discussion } from './entities/discussion.entity';
import { DiscussionCreationDto } from '@domains/discussion';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';

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
  create(@Body() data: DiscussionCreationDto, @AuthUser() user: AuthenticatedUser) {
    const tenantId = (user.userClaims?.tenantId as string | undefined) ?? 'default';
    const ctx = {
      identityId: user.userId as string,
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
