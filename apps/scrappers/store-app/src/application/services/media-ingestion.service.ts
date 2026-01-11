import { IMediaIngestor, RawMediaDto } from '@domains/catalog/media';

export class MediaIngestionService implements IMediaIngestor {
  constructor(private readonly queue: QueueClient) {
  }
  ingestMedia(media: RawMediaDto[]): void {
    throw new Error('Method not implemented.');
  }
}