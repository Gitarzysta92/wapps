import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { ItemListingContainerDirective } from '../../../../../libs/ui/components/items-listing/item-listing-container.directive';
import { concatMap, map, startWith, tap, withLatestFrom } from 'rxjs';
import { RouteDrivenContainerDirective } from '../../../../../libs/ui/routing/route-driven-container.directive';
import { ParamMapToAppListingRequestDtoMapper } from '../../../../../libs/features/listing/app/presentation/mappings/param-map-to-app-listing-request-dto.mapper';
import { AppListingService } from '../../../../../libs/features/listing/app/application/app-lisiting.service';
import { AppListingItemVm } from '../../../../../libs/features/listing/app/presentation/models/app-listing.vm';
import { LoadingListingSliceFactory } from '../../../../../libs/ui/components/items-listing/factories/loading-listing-slice.factory';
import { IListingSlice } from '../../../../../libs/ui/components/items-listing/models/listing-slice';
import { AppListingSliceDto } from '../../../../../libs/features/listing/app/application/models/app-listing.dto';
import { TuiSkeleton } from '@taiga-ui/kit';
import { AppMediumTileComponent } from '../../../../../libs/features/listing/app/presentation/app-medium-tile';
import { AsyncPipe } from '@angular/common';
import { InfiniteScrollDirective } from '../../../../../libs/ui/components/infinite-scroll/infinite-scroll.directive';
import { TuiIcon, TuiButton, TuiDialogService } from '@taiga-ui/core';
import { RouterLink } from '@angular/router';
import { MediumTileComponent } from '../../../../../libs/ui/components/layout/medium-tile/medium-tile.component';
import { AppDetailsDialogComponent } from '../../dialogs/app-details-dialog/app-details-dialog.component';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';


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
    AppMediumTileComponent,
    TuiSkeleton,
    TuiIcon,
    TuiButton,
    RouterLink,
    MediumTileComponent
  ],
  providers: [
    LoadingListingSliceFactory,
  ]
})
export class AppListingComponent implements OnInit {

  @Output() onUpdate: EventEmitter<{ page: string; }> = new EventEmitter();

  private readonly _routeContainer = inject(RouteDrivenContainerDirective, { self: true });
  private readonly _itemContainer = inject<ItemListingContainerDirective<AppListingItemVm>>(ItemListingContainerDirective, { self: true });
  private readonly _infiniteScroll = inject(InfiniteScrollDirective, { self: true });
  private readonly _mapper = inject(ParamMapToAppListingRequestDtoMapper);
  private readonly _factory = inject<LoadingListingSliceFactory<AppListingItemVm>>(LoadingListingSliceFactory)
  private readonly _service = inject(AppListingService);
  private readonly _dialogService = inject(TuiDialogService);

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

  public addToFavourites(item: AppListingItemVm): void {

  }

  public openAppDetailsModal(item: AppListingItemVm): void {
    this._dialogService.open(
      new PolymorpheusComponent(AppDetailsDialogComponent),
      { data: { app: item } }
    ).subscribe()
  }

  private _mapAppListingDtoToListingSlice(dto: AppListingSliceDto): IListingSlice<AppListingItemVm> {
    return {
      hash: dto.hash,
      count: dto.count,
      maxCount: dto.maxCount,
      index: dto.index,
      items: dto.items.map(i => Object.assign(i, { isLoaded: true, parentIndex: dto.index, }))
    }
  }

}
