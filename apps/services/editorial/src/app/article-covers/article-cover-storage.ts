import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { S3Client } from '@aws-sdk/client-s3';
import {
  articleCoverId,
  type ArticleCoverAsset,
  type ArticleCoverSourceType,
} from '@domains/catalog/media';
import { ConfiguredApplicationImageObjects } from '../application-media/configured-application-image-objects';
import { S3ApplicationImages } from '../application-media/s3-application-images';
import type { ApplicationImageNormalizer } from '../application-media/application-image.ports';
import type {
  ArticleCoverNormalizer,
  ArticleCoverObjects,
  ArticleCoverRetirementObjects,
} from './article-cover.ports';

export function articleCoverObjectKey(id: string) {
  return `article-covers/v1/${articleCoverId(id)}.webp`;
}
class NamespacedArticleCoverObjects extends ConfiguredApplicationImageObjects {
  protected override createObjects(client: S3Client, bucket: string) {
    return new S3ApplicationImages(client, bucket, articleCoverObjectKey);
  }
}
@Injectable()
export class ConfiguredArticleCoverObjects
  implements
    ArticleCoverObjects,
    ArticleCoverRetirementObjects,
    OnModuleDestroy
{
  private readonly objects: NamespacedArticleCoverObjects;
  constructor(config: ConfigService) {
    this.objects = new NamespacedArticleCoverObjects(config);
  }
  putImmutable(asset: ArticleCoverAsset, bytes: Uint8Array) {
    return this.objects.putImmutable({ ...asset, purpose: 'banner' }, bytes);
  }
  read(asset: ArticleCoverAsset, signal?: AbortSignal) {
    return this.objects.read({ ...asset, purpose: 'banner' }, signal);
  }
  retire(id: string) {
    return this.objects.retire(id);
  }
  onModuleDestroy() {
    this.objects.onModuleDestroy();
  }
}
export class ArticleCoverNormalizerAdapter implements ArticleCoverNormalizer {
  constructor(private readonly images: ApplicationImageNormalizer) {}
  normalize(bytes: Uint8Array, contentType: ArticleCoverSourceType) {
    return this.images.normalize(bytes, 'banner', contentType);
  }
}
