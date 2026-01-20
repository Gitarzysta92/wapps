import { MediaExtension, MediaPurpose } from "./constants";
import { MediaType } from "./constants";

export type RawMediaDto = {
  referenceIdentifier: unknown;
  name: string;
  url: string;
  extension: MediaExtension;
  type: MediaType;
  purpose: MediaPurpose;
}