export type AppDto = {
  id: unknown;
  slug: string;
  name: string;
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