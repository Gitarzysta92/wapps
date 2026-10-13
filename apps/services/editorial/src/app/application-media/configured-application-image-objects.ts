import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import {
  ApplicationImageUnavailableError,
  type ApplicationImageAsset,
} from '@domains/catalog/media';
import type {
  ApplicationImageObjects,
  ApplicationImageRetirementObjects,
} from './application-image.ports';
import { S3ApplicationImages } from './s3-application-images';

@Injectable()
export class ConfiguredApplicationImageObjects
  implements
    ApplicationImageObjects,
    ApplicationImageRetirementObjects,
    OnModuleDestroy
{
  private client?: S3Client;
  private objects?: S3ApplicationImages;
  constructor(private readonly config: ConfigService) {}
  putImmutable(asset: ApplicationImageAsset, bytes: Uint8Array) {
    return this.configured().putImmutable(asset, bytes);
  }
  read(asset: ApplicationImageAsset, signal?: AbortSignal) {
    return this.configured().read(asset, signal);
  }
  retire(id: string) {
    return this.configured().retire(id);
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
  protected createObjects(client: S3Client, bucket: string) {
    return new S3ApplicationImages(client, bucket);
  }
  private configured() {
    if (this.objects) return this.objects;
    const endpoint = this.config.get<string>('EDITORIAL_MEDIA_ENDPOINT');
    const bucket = this.config.get<string>('EDITORIAL_MEDIA_BUCKET');
    const accessKeyId = this.config.get<string>('EDITORIAL_MEDIA_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>(
      'EDITORIAL_MEDIA_SECRET_KEY'
    );
    try {
      if (
        !endpoint ||
        !bucket ||
        !accessKeyId ||
        !secretAccessKey ||
        !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)
      )
        throw new Error('Missing media configuration');
      const url = new URL(endpoint);
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.pathname !== '/' && url.pathname !== '')
      )
        throw new Error('Invalid media endpoint');
      this.client = new S3Client({
        endpoint: url.origin,
        region: 'us-east-1',
        forcePathStyle: true,
        maxAttempts: 2,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.objects = this.createObjects(this.client, bucket);
      return this.objects;
    } catch {
      throw new ApplicationImageUnavailableError(
        'Private application image storage is not configured'
      );
    }
  }
}
