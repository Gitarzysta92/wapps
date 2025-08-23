import { IListingItem } from "../interfaces/listing-item.interface";
import { ListingItemMetadata } from "./listing-item-metadata";

export interface IListingSlice<T extends IListingItem> {
  hash: string | null;
  count: number;
  maxCount: number;
  index: number
  items: Array<T & ListingItemMetadata>;
}