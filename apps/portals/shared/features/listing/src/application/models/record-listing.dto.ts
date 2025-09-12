import { AppPreviewDto } from "../../../../../../../../libs/domains/catalog/record/src/application/models/record-preview.dto";

export type AppListingSliceDto = {
  items: Array<AppPreviewDto>,
  count: number;
  maxCount: number;
  hash: string;
  index: number;
}