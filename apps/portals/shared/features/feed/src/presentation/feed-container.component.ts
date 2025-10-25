import { Component, ContentChild, inject, OnInit, TemplateRef } from "@angular/core";
import { NewsFeedService } from "./services/news-feed.service";
import { ContentFeedComponent, ContentFeedItemVm } from '@ui/content-feed';
import { AsyncPipe } from "@angular/common";
import { map, tap } from "rxjs";
import { IFeedItem } from "./models/feed-item.interface";

@Component({
  selector: 'feed-container',
  templateUrl: './feed-container.component.html',
  styleUrl: './feed-container.component.scss',
  standalone: true,
  imports: [
    ContentFeedComponent,
    AsyncPipe
  ]
})
export class FeedContainerComponent implements OnInit {

  @ContentChild('itemTemplate') itemTemplate: TemplateRef<{ $implicit: ContentFeedItemVm; }> | undefined;

  private readonly _newsFeedService = inject(NewsFeedService);

  public feedItems$ = this._newsFeedService.feedItems$
    .pipe(tap(console.log),map(i => i as (IFeedItem & ContentFeedItemVm)[]));

  ngOnInit(): void {
    this.loadNextItems()
  }

  
  
  public loadNextItems(): void {
    this._newsFeedService.loadNextPage();
  }
}
