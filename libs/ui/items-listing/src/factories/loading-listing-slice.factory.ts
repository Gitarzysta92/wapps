import { Injectable } from "@angular/core";
import { IListingSlice } from "../models/listing-slice";
import { IListingItem } from "../interfaces/listing-item.interface";
import { ListingItemMetadata } from "../models/listing-item-metadata";

@Injectable()
export class LoadingListingSliceFactory<T extends IListingItem> {

  create(
    index: number,
    hash: string | null,
    count: number,
    maxCount: number
  ): IListingSlice<T> {
    return {
      hash: hash,
      index: index,
      items: Array.from({ length: count }, (_, k) =>
        ({ id: k, isLoaded: false, parentIndex: index })) as Array<T & ListingItemMetadata>,
      count: count,
      maxCount: maxCount
    }
  }
}