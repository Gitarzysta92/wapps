import { IMediaIngestor, RawMediaDto, MediaType, MediaExtension, RAW_MEDIA_INGESTION_SLUG } from '@domains/catalog/media';
import { QueueChannel } from '../../infrastructure/queue-client';


type Asset = {
  src: string;
  type: 'logo' | 'gallery';
};

export class MediaIngestionService implements IMediaIngestor {

  constructor(
    private readonly queue: QueueChannel,
    private readonly queueName: string
  ) {
  }

  async initialize(): Promise<void> {
    await this.queue.assertQueue(this.queueName);
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

  ingestMedia(media: RawMediaDto[]): void {
    for (const item of media) {
      const message = JSON.stringify(item);
      this.queue.sendToQueue(this.queueName, Buffer.from(message));
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

