import { Component, inject } from '@angular/core';
import {
  TuiDropdown,
} from '@taiga-ui/core';
import {
  TuiBadgedContent,
} from '@taiga-ui/kit';
import { NavigationService } from '@ui/navigation';
import { GlobalStateService } from '../../state/global-state.service';
import { MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER, MultiSearchComponent } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { HomePageStateService } from '../../pages/home/home-page-state.service';


@Component({
  selector: 'header-v2',
  templateUrl: "header-v2.component.html",
  styleUrl: 'header-v2.component.scss',
  standalone: true,
  imports: [
    MultiSearchComponent,
    TuiDropdown,
    TuiBadgedContent,
  ],
  providers: [
    SearchMockDataService,
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HeaderV2PartialComponent {
  public readonly state = inject(GlobalStateService);
  public readonly navigation = inject(NavigationService).config;

}
