export type AppPreviewDto = {
  id: unknown;
  slug: string;
  name: string;
  logo: string;
  isPwa: boolean;
  rating: number;
  reviews: number;
  tagIds: number[];
  categoryId: number;
  platformIds: number[];
}
