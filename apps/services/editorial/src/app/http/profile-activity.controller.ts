import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { suiteObject } from '@domains/publication/suite';
import type { EditorialActor } from '../application/editorial.ports';
import { ProfilePublicationActivity } from '../application/profile-activity';
import { EditorialUser } from './editorial-auth';

@Controller('internal/profile-activity')
export class ProfileActivityController {
  constructor(private readonly activity: ProfilePublicationActivity) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @EditorialUser() actor: EditorialActor
  ) {
    suiteObject(query, []);
    return this.activity.read(body, actor);
  }
}
