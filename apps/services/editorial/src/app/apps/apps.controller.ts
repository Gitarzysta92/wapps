import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppsService } from './apps.service';
import { AppRecord } from './entities/app-record.entity';

@ApiTags('apps')
@Controller('apps')
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all app records' })
  findAll() {
    return this.appsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get app record by ID' })
  findOne(@Param('id') id: string) {
    return this.appsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new app record' })
  create(@Body() data: Partial<AppRecord>) {
    return this.appsService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update app record' })
  update(@Param('id') id: string, @Body() data: Partial<AppRecord>) {
    return this.appsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete app record' })
  remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }
}
