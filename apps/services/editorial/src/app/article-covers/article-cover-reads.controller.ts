import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  StreamableFile,
} from '@nestjs/common';
import type { ArticleCoverAsset } from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ArticleCoverReads } from './article-cover-reads';

function file(result: { asset: ArticleCoverAsset; bytes: Uint8Array }) {
  return new StreamableFile(Buffer.from(result.bytes), {
    type: result.asset.contentType,
    length: result.asset.bytes,
    disposition: 'inline; filename="article-cover.webp"',
  });
}
function revision(value: string) {
  if (!/^[1-9][0-9]{0,15}$/.test(value))
    throw new BadRequestException('Invalid submitted cover revision');
  return Number(value);
}
@Controller('me/articles')
export class ArticleDraftCoverReadsController {
  constructor(private readonly reads: ArticleCoverReads) {}
  @Get(':id/submissions/:revision/cover')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async submission(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('revision') version: string
  ) {
    return file(
      await this.reads.submission(actor, id, revision(version), false)
    );
  }
}
@Controller('editorial/article-reviews')
export class ArticleReviewCoverReadsController {
  constructor(private readonly reads: ArticleCoverReads) {}
  @Get(':id/submissions/:revision/cover')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async submission(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('revision') version: string
  ) {
    return file(
      await this.reads.submission(actor, id, revision(version), true)
    );
  }
}
@Controller('media/articles')
export class ArticlePublicCoverReadsController {
  constructor(private readonly reads: ArticleCoverReads) {}
  @Get(':id/:imageId')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async published(@Param('id') id: string, @Param('imageId') imageId: string) {
    return file(await this.reads.published(id, imageId));
  }
}
