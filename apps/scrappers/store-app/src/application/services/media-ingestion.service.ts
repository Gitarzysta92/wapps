import { IMediaIngestor, MediaDto } from '@domains/catalog/media';

export class MediaIngestionService implements IMediaIngestor {
  constructor(private readonly queue: QueueClient) {
  }
  ingestMedia(media: MediaDto): void {
    throw new Error('Method not implemented.');
  }
}