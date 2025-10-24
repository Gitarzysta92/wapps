import { ChangeDetectionStrategy, Component, Input, OnDestroy, TemplateRef, OnChanges, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiLoader } from '@taiga-ui/core';
import { InfiniteScrollDirective } from '@ui/infinite-scroll';
import { Subscription } from 'rxjs';
import { ContentFeedItemVm } from './content-feed-item.vm';

@Component({
  selector: 'content-feed',
  templateUrl: './content-feed.component.html',
  styleUrl: './content-feed.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: InfiniteScrollDirective,
      inputs: ['bottomOffset'],
      outputs: ['scrolledToBottom']
    }
  ],
  imports: [
    CommonModule,
    TuiLoader,
  ]
})
export class ContentFeedComponent implements OnInit, OnChanges, OnDestroy {
  @Input() feedItems: ContentFeedItemVm[] = [];
  @Input() itemTemplate: TemplateRef<{ $implicit: ContentFeedItemVm }> | undefined;

  public isLoading = false;

  private readonly _scrollDirective = inject(InfiniteScrollDirective);
  private _s: Subscription | undefined;

  ngOnInit(): void {
    this._s = this._scrollDirective.scrolledToBottom
      .subscribe(() => this.isLoading = true);
  }

  ngOnChanges(): void {
    this.isLoading = false
  }

  ngOnDestroy(): void {
    this._s?.unsubscribe();
  }

}
