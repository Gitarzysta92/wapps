import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { ItemListingContainerDirective } from '@ui/items-listing';
import { concatMap, map, startWith, tap, withLatestFrom } from 'rxjs';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { ParamMapToAppListingRequestDtoMapper } from '@ui/items-listing';
import { AppListingService } from '../../../../../libs/features/listing/app/application/app-lisiting.service';
import { AppListingItemVm } from '../../../../../libs/features/listing/app/presentation/models/app-listing.vm';
import { AppListingSliceDto } from '../../../../../libs/features/listing/app/application/models/app-listing.dto';
import { AppMediumTileComponent } from '../../../../../libs/features/listing/app/presentation/app-medium-tile';
import { LoadingListingSliceFactory, IListingSlice } from '@ui/items-listing';
import { TuiSkeleton } from '@taiga-ui/kit';
import { AsyncPipe } from '@angular/common';
import { InfiniteScrollDirective } from '@ui/infinite-scroll';
import { TuiIcon, TuiButton, TuiDialogService } from '@taiga-ui/core';
import { RouterLink } from '@angular/router';
import { MediumTileComponent } from '@ui/layout';
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
