import {
  Controller,
  Get,
  Header,
  Param,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ApplicationImageReads } from './application-image-reads';
import type { ApplicationImageAsset } from '@domains/catalog/media';

function file(result: { asset: ApplicationImageAsset; bytes: Uint8Array }) {
  return new StreamableFile(Buffer.from(result.bytes), {
    type: result.asset.contentType,
    length: result.asset.bytes,
    disposition: 'inline; filename="application-image.webp"',
  });
}
function revision(value: string) {
  if (!/^[1-9][0-9]{0,15}$/.test(value))
    throw new BadRequestException('Invalid submitted image revision');
  return Number(value);
}
@Controller('me/application-drafts')
export class ApplicationDraftImageReadsController {
  constructor(private readonly reads: ApplicationImageReads) {}
  @Get(':id/images/:purpose/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async draft(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('purpose') purpose: string
  ) {
    return file(await this.reads.draft(actor, id, purpose));
  }
  @Get('canonical/:id/images/:purpose/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async source(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('purpose') purpose: string
  ) {
    return file(await this.reads.draft(actor, id, purpose, true));
  }
  @Get(':id/submissions/:revision/images/:purpose/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async submission(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('revision') version: string,
    @Param('purpose') purpose: string
  ) {
    return file(
      await this.reads.submission(actor, id, revision(version), purpose, false)
    );
  }
}
@Controller('editorial/application-reviews')
export class ApplicationReviewImageReadsController {
  constructor(private readonly reads: ApplicationImageReads) {}
  @Get(':id/submissions/:revision/images/:purpose/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async submission(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('revision') version: string,
    @Param('purpose') purpose: string
  ) {
    return file(
      await this.reads.submission(actor, id, revision(version), purpose, true)
    );
  }
}
@Controller('media/applications')
export class ApplicationPublicImageReadsController {
  constructor(private readonly reads: ApplicationImageReads) {}
  @Get(':id/:purpose/:imageId')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async published(
    @Param('id') id: string,
    @Param('purpose') purpose: string,
    @Param('imageId') imageId: string
  ) {
    return file(await this.reads.published(id, purpose, imageId));
  }
}
