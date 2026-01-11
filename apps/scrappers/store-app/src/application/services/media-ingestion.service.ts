import { IMediaIngestor, RawMediaDto, MediaType, MediaExtension } from '@domains/catalog/media';
import { QueueChannel } from '../../infrastructure/queue-client';
import { APP_RECORD_QUEUE_NAME } from '@domains/catalog/record';

type Asset = {
  src: string;
  type: 'logo' | 'gallery';
};

export class MediaIngestionService implements IMediaIngestor {
  constructor(private readonly queue: QueueChannel) {
  }

  mapAssetsToRawMedia(assets: Asset[]): RawMediaDto[] {
    return assets.map((asset, index) => {
      const extension = this.getExtensionFromUrl(asset.src);
      const fileName = asset.src.split('/').pop() || `asset-${index}`;
      
      return {
        referenceIdentifier: null,
        name: fileName,
        url: asset.src,
        extension: extension,
        type: MediaType.IMAGE,
      };
    });
  }

  ingestMedia(assets: RawMediaDto[]): void {
    const rawMedia: RawMediaDto[] = assets.map((asset) => {
      return {
        referenceIdentifier: null,
        name: asset.name,
        url: asset.url,
        extension: asset.extension,
        type: MediaType.IMAGE,
      };
    });

    for (const media of rawMedia) {
      const message = JSON.stringify(media);
      this.queue.sendToQueue(APP_RECORD_QUEUE_NAME, Buffer.from(message));
    }
  }

  private getExtensionFromUrl(url: string): MediaExtension {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = pathname.split('.').pop()?.toLowerCase() || 'jpg';
      
      // Map common extensions to MediaExtension enum
      const extensionMap: Record<string, MediaExtension> = {
        'png': MediaExtension.PNG,
        'jpg': MediaExtension.JPG,
        'jpeg': MediaExtension.JPEG,
        'gif': MediaExtension.GIF,
        'webp': MediaExtension.WEBP,
        'svg': MediaExtension.SVG,
        'ico': MediaExtension.ICO,
        'bmp': MediaExtension.BMP,
        'tiff': MediaExtension.TIFF,
        'webm': MediaExtension.WEBM,
        'mp4': MediaExtension.MP4,
        'mp3': MediaExtension.MP3,
      };
      
      return extensionMap[extension] || MediaExtension.JPG;
    } catch {
      return MediaExtension.JPG;
    }
  }
}

