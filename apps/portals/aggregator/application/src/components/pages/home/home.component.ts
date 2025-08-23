import { Component } from "@angular/core";
import { ListingSearchService } from "../../../../../libs/features/listing/search/services/listing-search.service";
import { StickyElementDirective } from "../../../../../libs/ui/directives/sticky-element/sticky-element.directive";
import { MultiSearchComponent } from "../../../../../libs/ui/components/multi-search/multi-search.component";
import { MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "../../../../../libs/ui/components/multi-search/multi-search.constants";
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