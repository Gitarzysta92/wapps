import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
  UseFilters,
} from '@nestjs/common';
import { raw, type Request, type Response } from 'express';
import {
  ARTICLE_COVER_SOURCE_LIMIT,
  articleCoverId,
  articleCoverInteger,
} from '@domains/catalog/media';
import { singleHeader } from '../identity/trusted-portal-identity';
import {
  articleRequest,
  articleUnavailable,
  PortalArticleErrorFilter,
  PortalArticleRequest,
} from './portal-articles.request';
import {
  PortalArticleCoversClient,
  type ArticleCoverPreview,
} from './portal-article-covers.client';

@Controller()
@UseFilters(PortalArticleErrorFilter)
export class PortalArticleCoversController {
  private uploads = 0;
  private previews = 0;
  constructor(
    private readonly requests: PortalArticleRequest,
    private readonly images: PortalArticleCoversClient
  ) {}

  @Get('me/article-covers')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request) {
    const actor = this.requests.actor(request, ['articleId']);
    return this.images.list(
      actor,
      articleRequest(() => articleCoverId(request.query.articleId))
    );
  }
  @Get('me/article-covers/:id')
  @Header('Cache-Control', 'private, no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const actor = this.requests.actor(request);
    return this.images.read(
      actor,
      articleRequest(() => articleCoverId(id))
    );
  }
  @Post('me/article-covers')
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    return this.images.create(
      this.requests.actor(request),
      body,
      this.requests.key(request)
    );
  }
  @Delete('me/article-covers/:id')
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.images.cancel(
      actor,
      articleRequest(() => articleCoverId(id)),
      body,
      this.requests.key(request)
    );
  }
  @Put('me/article-covers/:id/content')
  @Header('Cache-Control', 'private, no-store')
  async upload(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string
  ) {
    const actor = this.requests.actor(request);
    const target = articleRequest(() => articleCoverId(id));
    const key = this.requests.key(request);
    const match = singleHeader(request, 'if-match', 18);
    if (!match || !/^"[1-9][0-9]{0,15}"$/.test(match))
      throw new BadRequestException(
        'If-Match must contain the quoted upload revision'
      );
    const revision = articleRequest(() =>
      articleCoverInteger(Number(match.slice(1, -1)))
    );
    const type = singleHeader(request, 'content-type', 64),
      encoding = singleHeader(request, 'content-encoding', 32);
    if (
      type !== 'application/octet-stream' ||
      (encoding !== undefined && encoding !== 'identity')
    )
      throw new UnsupportedMediaTypeException(
        'Send uncompressed application/octet-stream image bytes'
      );
    const length = singleHeader(request, 'content-length', 16);
    if (
      length !== undefined &&
      (!/^[1-9][0-9]*$/.test(length) || !Number.isSafeInteger(Number(length)))
    )
      throw new BadRequestException('Invalid image body size');
    if (length !== undefined && Number(length) > ARTICLE_COVER_SOURCE_LIMIT)
      throw new PayloadTooLargeException('Image exceeds 8 MiB');
    if (this.uploads >= 2) throw articleUnavailable();
    this.uploads++;
    const abort = new AbortController();
    const disconnected = () => {
      if (!response.writableEnded) abort.abort();
    };
    response.once('close', disconnected);
    try {
      // Re-enter Editorial authorization before allocating a private upload buffer.
      const reserved = await this.images.read(actor, target, abort.signal);
      if (length !== undefined && Number(length) !== reserved.source.bytes)
        throw new BadRequestException(
          'Image size differs from its reservation'
        );
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => request.destroy(), 15_000);
        raw({
          type: () => true,
          limit: ARTICLE_COVER_SOURCE_LIMIT,
          inflate: false,
        })(request, response, (error: unknown) => {
          clearTimeout(deadline);
          if (!error) return resolve();
          reject(
            typeof error === 'object' &&
              error !== null &&
              'status' in error &&
              error.status === 413
              ? new PayloadTooLargeException('Image exceeds 8 MiB')
              : new BadRequestException('Invalid image body')
          );
        });
      });
      if (
        !Buffer.isBuffer(request.body) ||
        request.body.length !== reserved.source.bytes ||
        createHash('sha256').update(request.body).digest('hex') !==
          reserved.source.sha256
      )
        throw new BadRequestException(
          'Image bytes differ from their reservation'
        );
      // Do not gate on current upload status: Editorial owns historical receipt replay.
      return await this.images.upload(
        actor,
        target,
        revision,
        request.body,
        key,
        abort.signal
      );
    } finally {
      response.off('close', disconnected);
      this.uploads--;
    }
  }

  @Get('me/article-covers/:id/content')
  uploadPreview(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string
  ) {
    return this.preview(request, response, () => ({
      kind: 'upload',
      id: articleCoverId(id),
    }));
  }
  @Get('me/articles/:id/submissions/:revision/cover')
  submissionPreview(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Param('revision') revision: string
  ) {
    return this.submission(request, response, id, revision, false);
  }
  @Get('editorial/article-reviews/:id/submissions/:revision/cover')
  reviewPreview(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Param('revision') revision: string
  ) {
    return this.submission(request, response, id, revision, true);
  }
  @Get('media/articles/:id/:imageId')
  published(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Param('imageId') imageId: string
  ) {
    return this.preview(
      request,
      response,
      () => ({
        kind: 'published',
        id: articleCoverId(id),
        imageId: articleCoverId(imageId),
      }),
      true
    );
  }
  private submission(
    request: Request,
    response: Response,
    id: string,
    revision: string,
    review: boolean
  ) {
    return this.preview(request, response, () => {
      if (!/^[1-9][0-9]{0,15}$/.test(revision))
        throw new Error('Invalid submitted revision');
      return {
        kind: 'submission',
        id: articleCoverId(id),
        revision: articleCoverInteger(Number(revision)),
        review,
      };
    });
  }
  private async preview(
    request: Request,
    response: Response,
    parse: () => ArticleCoverPreview,
    published = false
  ) {
    const actor = published
      ? this.requests.viewer(request)
      : this.requests.actor(request);
    const target = articleRequest(parse);
    if (this.previews >= 4) throw articleUnavailable();
    this.previews++;
    const abort = new AbortController();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.previews--;
      abort.abort();
      response.off('finish', release);
      response.off('close', release);
    };
    response.once('finish', release);
    response.once('close', release);
    try {
      const bytes = await this.images.preview(actor, target, abort.signal);
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; sandbox"
      );
      response.setHeader('Vary', 'Authorization');
      return new StreamableFile(bytes, {
        type: 'image/webp',
        length: bytes.length,
        disposition: 'inline; filename="article-cover.webp"',
      });
    } catch (error) {
      release();
      throw error;
    }
  }
}
