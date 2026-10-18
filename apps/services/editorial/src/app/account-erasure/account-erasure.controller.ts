import { Body, Controller, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AccountErasureAccess } from '@wapps/account';
import {
  accountExportObject,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import { EditorialUser } from '../http/editorial-auth';
import type { EditorialActor } from '../application/editorial.ports';

@Controller('internal/account-erasure')
export class AccountErasureController {
  constructor(private readonly access: AccountErasureAccess) {}
  @Post()
  async request(
    @Body() body: unknown,
    @Query() query: unknown,
    @EditorialUser() actor: EditorialActor,
    @Res() response: Response
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    try {
      accountExportObject(query, []);
      const receipt = await this.access.request(body, actor);
      response.status(receipt.state === 'pending' ? 202 : 200).json(receipt);
    } catch (error) {
      const status =
        error instanceof CanonicalIdentityAccessDenied
          ? 403
          : error instanceof CanonicalIdentityInputError
          ? 400
          : error instanceof CanonicalIdentityConflict
          ? 409
          : 503;
      if (status === 503) response.setHeader('Retry-After', '5');
      response.status(status).json({
        statusCode: status,
        message:
          status === 503
            ? 'Account erasure participant unavailable'
            : 'Account erasure request denied or invalid',
      });
    }
  }
}
