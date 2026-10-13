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
import { ProfilePublicationTotals } from '../application/profile-totals';
import { EditorialUser } from './editorial-auth';

@Controller('internal/profile-totals')
export class ProfileTotalsController {
  constructor(private readonly activity: ProfilePublicationTotals) {}
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
