import { MediaExtension } from "./media-extension.constant";
import { MediaType } from "./media-type.constant";

export type RawMediaDto = {
  referenceIdentifier: unknown;
  name: string;
  url: string;
  extension: MediaExtension;
  type: MediaType;
}