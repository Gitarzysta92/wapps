import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { raw, type Request, type Response } from 'express';
import {
  ARTICLE_COVER_SOURCE_LIMIT,
  ArticleCoverUnavailableError,
  articleCoverInteger,
  articleCoverId,
  articleCoverObject,
} from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ArticleCovers } from './article-covers';

@Controller('me/article-covers')
export class ArticleCoversController {
  private activeUploads = 0;
  constructor(private readonly images: ArticleCovers) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    const value = articleCoverObject(query, ['articleId']);
    return this.images.list(actor, articleCoverId(value['articleId']));
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  cancel(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.images.cancel(actor, id, body, key);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @EditorialUser() actor: EditorialActor,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.images.create(actor, body, key);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.images.read(actor, id);
  }
  @Put(':id/content')
  @Header('Cache-Control', 'no-store')
  async upload(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Headers('if-match') match: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    if (typeof match !== 'string' || !/^"[1-9][0-9]{0,15}"$/.test(match))
      throw new BadRequestException(
        'If-Match must contain the quoted upload revision'
      );
    const expectedRevision = articleCoverInteger(Number(match.slice(1, -1)));
    if (
      request.headers['content-type'] !== 'application/octet-stream' ||
      (request.headers['content-encoding'] !== undefined &&
        request.headers['content-encoding'] !== 'identity')
    )
      throw new UnsupportedMediaTypeException(
        'Send uncompressed application/octet-stream image bytes'
      );
    if (this.activeUploads >= 2)
      throw new ArticleCoverUnavailableError(
        'Image uploads are busy. Retry the same request shortly.'
      );
    this.activeUploads++;
    try {
      // Bound resident request buffers as well as decoder concurrency.
      // Authorize this private reservation before buffering an untrusted binary request.
      await this.images.read(actor, id);
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => request.destroy(), 15_000);
        raw({
          type: () => true,
          limit: ARTICLE_COVER_SOURCE_LIMIT,
          inflate: false,
        })(request, response, (error: unknown) => {
          clearTimeout(deadline);
          if (!error) return resolve();
          const status =
            typeof error === 'object' && error !== null && 'status' in error
              ? error.status
              : null;
          reject(
            status === 413
              ? new PayloadTooLargeException(
                  'Image body exceeds the upload limit'
                )
              : new BadRequestException('Invalid image body')
          );
        });
      });
      if (!Buffer.isBuffer(request.body))
        throw new BadRequestException('A binary image body is required');
      return await this.images.upload(
        actor,
        id,
        { expectedRevision },
        request.body,
        key
      );
    } finally {
      this.activeUploads--;
    }
  }
  @Get(':id/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async content(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string
  ) {
    const result = await this.images.content(actor, id);
    return new StreamableFile(Buffer.from(result.bytes), {
      type: result.asset.contentType,
      length: result.asset.bytes,
      disposition: 'inline; filename="article-cover.webp"',
    });
  }
}
