import { IListingSlice } from "./listing-slice";
import { IListingItem } from "../interfaces/listing-item.interface";
import { ListingItemMetadata } from "./listing-item-metadata";


export class ListingContainerState<T extends IListingItem> {
  
  public get startingIndex() { return this.slices[0].index }
  public get lastIndex() { return this.slices[this.slices.length - 1].index }
  public get currentSlice(): IListingSlice<T> {
    return this.slices.find(s => s.index === this.currentIndex)!
  }
  public get slicesCount(): number { return 0 }
  public get itemsCount() { return this.items.length }

  public hasPrevSlicesToLoad = false;
  public hasNextSlicesToLoad = false;


  constructor(
    public currentIndex: number,
    public maxCount: number = 0,
    public hash: string | null,
    public slices: IListingSlice<T>[] = [],
    public items: Array<T & ListingItemMetadata> = []
  ) { 
    this.hasPrevSlicesToLoad = this.getPrevSlicesCount() > 0
    this.hasNextSlicesToLoad = this.getNextSlicesCount() > 0;
  }


  public next(slice: IListingSlice<T>): ListingContainerState<T> {
    const newState = this.clone();

    if (newState.slices.some(s => s.index === slice.index)) {
      const index = newState.slices.findIndex(s => s.index === slice.index);
      if (index !== -1) {
        newState.slices[index] = slice;
        const start = index * slice.items.length;
        newState.items.splice(start, slice.items.length, ...slice.items);
      }
    } else  {
      if (newState.currentIndex > slice.index) {
        newState.slices.unshift(slice);
        newState.items.unshift(...slice.items);
      } else {
        newState.slices.push(slice);
        newState.items.push(...slice.items);
      }
    }

    newState.currentIndex = slice.index;
    newState.hasPrevSlicesToLoad = newState.getPrevSlicesCount() > 0;
    newState.hasNextSlicesToLoad = newState.getNextSlicesCount() > 0;
    return newState;
  }

  public clone(): ListingContainerState<T> {
    return new ListingContainerState(
      this.currentIndex,
      this.maxCount,
      this.hash,
      [...this.slices],
      [...this.items]
    )
  }

  public getPrevSlicesCount(): number {
    return this.startingIndex - 1;
  }

  public getNextSlicesCount(): number {
    return this.getMaxIndex() - this.lastIndex;
  }

  public getMaxIndex(): number {
    return this.maxCount / this.slices[0].count;
  }
}
