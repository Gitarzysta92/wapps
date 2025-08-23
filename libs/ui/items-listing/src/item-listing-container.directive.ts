import { Directive, inject } from '@angular/core';
import { IListingSlice } from './models/listing-slice';
import { IListingItem } from "./interfaces/listing-item.interface";
import { BehaviorSubject, Observable } from 'rxjs';
import { ListingContainerState } from './models/listing-container.state';
import { ListingContainerFactory } from './factories/listing-container.factory';

@Directive({
  selector: '[itemListingContainer]',
  exportAs: 'itemListingContainer',
  providers: [
    ListingContainerFactory
  ]
})
export class ItemListingContainerDirective<T extends IListingItem> {

  private readonly _factory = inject(ListingContainerFactory)

  public get state() { return this._state$.value }

  private readonly _state$ = new BehaviorSubject<ListingContainerState<T>>(null as any)

  public readonly state$ = this._state$ as Observable<ListingContainerState<T>>;


  public update(slice: IListingSlice<T>): void {
    if (this._state$?.value?.hash !== slice.hash) {
      this._state$.next(this._factory.createNewState(slice))
    } else {
      this._state$.next(this.state.next(slice))
    }
  }

  public clear(): void {
    console.log('clear')
  }

}