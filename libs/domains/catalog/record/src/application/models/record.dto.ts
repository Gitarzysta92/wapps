export type AppRecordDto = {
  id: unknown;
  slug: string;
  name: string;
  description: string;
  logo: string;
  isPwa: boolean;
  rating: number;
  tagIds: number[];
  categoryId: number;
  platformIds: number[];

  reviewNumber: number;
  updateDate: Date;
  listingDate: Date;
}