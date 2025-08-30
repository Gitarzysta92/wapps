import { AppPreviewDto } from "./app-preview.dto";

export type AppListingSliceDto = {
  items: Array<AppPreviewDto>,
  count: number;
  maxCount: number;
  hash: string;
  index: number;
}