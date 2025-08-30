export type AppListingQueryDto = {
  index: number;
  batchSize: number;
  query: { [key: string]: string[] }
}