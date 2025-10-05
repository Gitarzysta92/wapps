import { Component, ViewChild, TemplateRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TuiDropdown } from "@taiga-ui/core";
import { TuiBadgedContent } from "@taiga-ui/kit";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from '@portals/shared/features/multi-search';
import { SearchMockDataService, ListingSearchService } from '@portals/shared/features/search';
import { NewsFeedPageComponent } from '@portals/shared/features/feed';
import { HomePageStateService } from "./home-page-state.service";
import { IFeedItem } from '@portals/shared/features/feed';


 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  imports: [
    CommonModule,
    MultiSearchComponent,
    NewsFeedPageComponent,
    TuiDropdown,
    TuiBadgedContent,
  ],
  providers: [
    SearchMockDataService,
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HomePageComponent {
  @ViewChild('itemTemplate', { static: true }) itemTemplate!: TemplateRef<{ $implicit: IFeedItem }>;
}