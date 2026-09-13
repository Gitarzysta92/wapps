import { Component, ContentChild, inject, OnInit, TemplateRef } from "@angular/core";
import { NewsFeedService } from "./services/news-feed.service";
import { ContentFeedComponent, ContentFeedItemVm } from '@ui/content-feed';
import { AsyncPipe } from "@angular/common";
import { combineLatest, map } from "rxjs";
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { ContentStateComponent } from '@ui/layout';
import { IFeedItem } from "./models/feed-item.interface";

@Component({
  selector: 'feed-container',
  templateUrl: './feed-container.component.html',
  styleUrl: './feed-container.component.scss',
  standalone: true,
  imports: [
    ContentFeedComponent,
    AsyncPipe, RouterLink, TuiButton, ContentStateComponent
  ]
})
export class FeedContainerComponent implements OnInit {

  @ContentChild('itemTemplate') itemTemplate: TemplateRef<{ $implicit: ContentFeedItemVm; }> | undefined;

  private readonly _newsFeedService = inject(NewsFeedService);

  public feedItems$ = this._newsFeedService.feedItems$
    .pipe(map(i => i as (IFeedItem & ContentFeedItemVm)[]));

  readonly state$ = combineLatest({
    items: this.feedItems$,
    loading: this._newsFeedService.loading$,
    loaded: this._newsFeedService.loaded$,
    error: this._newsFeedService.error$,
  });

  ngOnInit(): void {
    this.loadNextItems()
  }

  
  
  public loadNextItems(): void {
    this._newsFeedService.loadNextPage();
  }
}
