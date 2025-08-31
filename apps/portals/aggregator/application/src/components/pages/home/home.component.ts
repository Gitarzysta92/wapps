import { Component } from "@angular/core";
import { ListingSearchService } from "@portals/shared/features/search";
import { StickyElementDirective } from "@ui/misc";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "@ui/multi-search";
import { HomePageStateService } from "./home-page-state.service";

 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  standalone: true,
  imports: [
    MultiSearchComponent,
    StickyElementDirective
  ],
  providers: [
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HomePageComponent {}