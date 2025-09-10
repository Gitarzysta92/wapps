import { TagDto } from "../../../tags/application/models/tag.dto";

export type AppListingSearchRecordDto = {
  id: number;
  name: string;
  description: string;
  rating: number;
  tagIds: TagDto[];
  platformIds: number[];
  deviceIds: number[];
 // associatedSuites: SuiteSearchRecordDto[];
}