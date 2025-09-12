export type SearchRecordDto = {
  id: number;
  name: string;
  description: string;
  rating: number;
  tagIds: string[];
  platformIds: number[];
  deviceIds: number[];
 // associatedSuites: SuiteSearchRecordDto[];
}