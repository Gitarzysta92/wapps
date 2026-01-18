export interface AppRecordDto {
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

export interface AppPreviewDto {
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

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface PaginatedAppsResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
