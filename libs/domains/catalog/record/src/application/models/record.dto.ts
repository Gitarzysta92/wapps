export type AppRecordDto = {
  id: unknown;
  slug: string;
  name: string;
  description: string;
  logo: string;
  isPwa?: boolean;
  rating: number;
  tagIds: string[];
  categoryId: string;
  platformIds: number[];

  reviewNumber: number;
  updateTimestamp?: number;
  creationTimestamp?: number;
  updateDate: Date;
  listingDate?: Date;
}