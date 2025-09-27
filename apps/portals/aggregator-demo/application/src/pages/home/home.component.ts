import { Component, signal } from "@angular/core";
import { ListingSearchService, SearchMockDataService } from "@portals/shared/features/search";
import { StickyElementDirective } from "@ui/misc";
import { MultiSearchComponent, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "@portals/shared/features/multi-search";
import { HomePageStateService } from "./home-page-state.service";
import { ChatWindowComponent, ChatMessage } from "@ui/chat";

 
@Component({
  selector: 'home-page',
  templateUrl: "home.component.html",
  styleUrl: 'home.component.scss',
  standalone: true,
  imports: [
    MultiSearchComponent,
    StickyElementDirective,
    ChatWindowComponent
  ],
  providers: [
    SearchMockDataService,
    { provide: MULTISEARCH_RESULTS_PROVIER, useClass: ListingSearchService },
    { provide: MULTISEARCH_STATE_PROVIDER, useClass: HomePageStateService }
  ]
})
export class HomePageComponent {
  public readonly chatMessages = signal<ChatMessage[]>([
    {
      id: '1',
      text: 'Welcome! How can I help you find what you\'re looking for?',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      sender: 'other',
      senderName: 'Assistant'
    },
    {
      id: '2',
      text: 'I\'m looking for some great apps to try out.',
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      sender: 'user'
    },
    {
      id: '3',
      text: 'Great! I can help you discover amazing applications. What type of apps are you interested in?',
      timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      sender: 'other',
      senderName: 'Assistant'
    }
  ]);


}