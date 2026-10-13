import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { suiteObject } from '@domains/publication/suite';
import { EditorialUser } from '../http/editorial-auth';
import type { EditorialActor } from '../application/editorial.ports';
import { ProfileSuites } from './profile-suites';

@Controller('internal/profile-suites')
export class ProfileSuitesController {
  constructor(private readonly suites: ProfileSuites) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @EditorialUser() actor: EditorialActor
  ) {
    suiteObject(query, []);
    return this.suites.read(body, actor);
  }
}
