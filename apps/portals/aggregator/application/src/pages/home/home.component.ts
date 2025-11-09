import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ListingSearchService, SearchMockDataService } from "@portals/shared/features/search";
import { provideTypedClass, StickyElementDirective } from "@ui/misc";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "@portals/shared/features/multi-search";
import { 
  FullSearchRedirectComponent, 
  SearchResultPreviewList, 
  SearchResultListSkeleton, 
  RecentSearchesList 
} from "@ui/search-results";
import { HomePageStateService } from "./home-page-state.service";

 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MultiSearchComponent,
    FullSearchRedirectComponent,
    SearchResultPreviewList,
    SearchResultListSkeleton,
    RecentSearchesList,
    StickyElementDirective
  ],
  providers: [
    SearchMockDataService,
    provideTypedClass(MULTISEARCH_RESULTS_PROVIER, ListingSearchService),
    provideTypedClass(MULTISEARCH_STATE_PROVIDER, HomePageStateService)
  ]
})
export class HomePageComponent {}