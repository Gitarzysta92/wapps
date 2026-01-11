import { MediaDto } from "./media.dto";

export interface IMediaIngestor {
  ingestMedia(media: MediaDto): void;
}