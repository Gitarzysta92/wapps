import { Component } from "@angular/core";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { HomePageStateService } from "./home-page-state.service";


 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
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
export class HomePageComponent {}