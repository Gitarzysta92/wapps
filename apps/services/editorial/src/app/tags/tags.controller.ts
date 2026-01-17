import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { Tag } from './entities/tag.entity';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tags' })
  findAll() {
    return this.tagsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  findOne(@Param('id') id: string) {
    return this.tagsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  create(@Body() data: Partial<Tag>) {
    return this.tagsService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tag' })
  update(@Param('id') id: string, @Body() data: Partial<Tag>) {
    return this.tagsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tag' })
  remove(@Param('id') id: string) {
    return this.tagsService.remove(id);
  }
}
