import { Injectable } from "@angular/core";
import { IListingItem } from "../interfaces/listing-item.interface";
import { IListingSlice } from "../models/listing-slice";
import { ListingContainerState } from "../models/listing-container.state";

@Injectable()
export class ListingContainerFactory<T extends IListingItem> {


  createNewState(slice: IListingSlice<T>): ListingContainerState<T> {
    return new ListingContainerState(slice.index ?? 0, slice.maxCount, slice.hash, [slice], slice.items)
  }

}