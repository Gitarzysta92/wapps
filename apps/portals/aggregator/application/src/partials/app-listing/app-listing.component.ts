import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { ItemListingContainerDirective } from '@ui/items-listing';
import { concatMap, map, startWith, tap, withLatestFrom } from 'rxjs';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { ParamMapToAppListingRequestDtoMapper } from '@ui/items-listing';
import { LoadingListingSliceFactory, IListingSlice } from '@ui/items-listing';
import { TuiSkeleton } from '@taiga-ui/kit';
import { AsyncPipe } from '@angular/common';
import { InfiniteScrollDirective } from '@ui/infinite-scroll';
import { TuiIcon, TuiButton } from '@taiga-ui/core';
import { RouterLink } from '@angular/router';

// Shared features imports using aliases
import { AppListingService } from '@portals/shared/features/listing';
import { AppPreviewDto } from '@domains/catalog/record';
// NOTE: avoid deep imports into shared feature internals in this app (kept minimal for build stability).
type AppListingSliceDto = any;

// Generic interfaces for abstraction
interface IListingItem {
  id: unknown;
  name: string;
  logo?: string;
  isLoaded: boolean;
  parentIndex: number;
}


@Component({
  selector: 'app-listing',
  templateUrl: './app-listing.component.html',
  styleUrl: './app-listing.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective,
    ItemListingContainerDirective,
    InfiniteScrollDirective 
  ],
  imports: [ 
    AsyncPipe,
    TuiSkeleton,
    TuiIcon,
    TuiButton,
    RouterLink,
  ],
  providers: [
    LoadingListingSliceFactory,
  ]
})
export class AppListingComponent implements OnInit {

  @Output() onUpdate: EventEmitter<{ page: string; }> = new EventEmitter();
  @Output() onItemClick: EventEmitter<IListingItem> = new EventEmitter();
  @Output() onItemFavourite: EventEmitter<IListingItem> = new EventEmitter();

  private readonly _routeContainer = inject(RouteDrivenContainerDirective, { self: true });
  private readonly _itemContainer = inject<ItemListingContainerDirective<IListingItem>>(ItemListingContainerDirective, { self: true });
  private readonly _infiniteScroll = inject(InfiniteScrollDirective, { self: true });
  private readonly _mapper = inject(ParamMapToAppListingRequestDtoMapper);
  private readonly _factory = inject<LoadingListingSliceFactory<IListingItem>>(LoadingListingSliceFactory);
  private readonly _service = inject(AppListingService);
  //private readonly _dialogService = inject(TuiDialogService);

  public listing$ = this._itemContainer.state$.pipe(tap(console.log));

  ngOnInit(): void {
    this._routeContainer.params$
      .pipe(
        map(ps => this._mapper.map(ps)),
        concatMap(p =>
          this._service.getApps(p)
            .pipe(
              map(as => this._mapAppListingDtoToListingSlice(as)),
              startWith(this._factory.create(
                p.index,
                this._itemContainer?.state?.hash ?? null,
                p.batchSize,
                this._itemContainer?.state?.maxCount ?? 0
              )),
            )
        )
    ).subscribe({
      next: as => this._itemContainer.update(as),
      //error: () => this._itemContainer.clear()
    })

    this._infiniteScroll.scrolledToBottom
      .pipe(withLatestFrom(this.listing$))
      .subscribe(([_, l]) => {
        this.changePage(l.currentIndex + 1)
      })
  }

  public changePage(p: number): void {
    this.onUpdate.next({ page: p.toString() })
  }

  public addToFavourites(item: IListingItem): void {
    this.onItemFavourite.emit(item);
  }

  public openAppDetailsModal(item: IListingItem): void {
    this.onItemClick.emit(item);
    
    // Note: Dialog opening should be handled by parent component or service
    // to maintain separation of concerns
  }

  private _mapAppListingDtoToListingSlice(dto: AppListingSliceDto): IListingSlice<IListingItem> {
    return {
      hash: dto.hash,
      count: dto.count,
      maxCount: dto.maxCount,
      index: dto.index,
      items: dto.items.map((i: AppPreviewDto) => ({
        id: i.id,
        name: i.name,
        logo: i.logo,
        isLoaded: true,
        parentIndex: dto.index,
      }))
    }
  }
}
