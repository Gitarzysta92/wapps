import { ISuiteSearchRecord } from "./suite-search-record-dto.interface";
import { ITagDto } from "./tag-dto.interface";

export interface IAppListingSearchRecordDto {
  id: number;
  name: string;
  description: string;
  rating: number;
  tagIds: ITagDto[];
  platformIds: number[];
  deviceIds: number[];
  associatedSuites: ISuiteSearchRecord[];
}