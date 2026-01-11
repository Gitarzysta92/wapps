import { RawMediaDto } from "./raw-media.dto";

export interface IMediaIngestor {
  ingestMedia(media: RawMediaDto): void;
}