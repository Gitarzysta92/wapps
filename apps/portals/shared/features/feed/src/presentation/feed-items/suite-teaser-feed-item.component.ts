import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor, NgIf } from '@angular/common';
import type { SuiteTeaserFeedItem } from '@domains/feed';

export const SUITE_TEASER_FEED_ITEM_SELECTOR = 'suite-teaser-feed-item';

export type SuiteTeaserFeedItemVM = Omit<SuiteTeaserFeedItem, never> & {
  suiteLink: string;
}

@Component({
  selector: SUITE_TEASER_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    NgFor,
    NgIf
  ],
  template: `
    <content-feed-item
      icon="@tui.layout-grid"
      [item]="item">
      <div class="item-content" content>
        <div class="suite-container">
          <tui-chip 
            class="suite-category" 
            appearance="primary"
            size="s">
            {{ item.category }}
          </tui-chip>
          
          <div class="suite-header">
            <h3 class="suite-title">{{ item.suiteTitle }}</h3>
            <p class="suite-description">{{ item.suiteDescription }}</p>
            <div class="suite-meta">
              <tui-icon icon="@tui.box" class="meta-icon" />
              <span class="apps-count">{{ item.apps.length }} Applications</span>
            </div>
          </div>

          <div class="apps-grid">
            <div *ngFor="let app of item.apps" class="app-tile">
              <tui-avatar
                size="l"
                class="app-logo">
                {{ app.name.substring(0, 2) }}
              </tui-avatar>
              <div class="app-info">
                <div class="app-name">{{ app.name }}</div>
                <div class="app-description" *ngIf="app.description">
                  {{ app.description }}
                </div>
              </div>
            </div>
          </div>

          <button
            class="suite-cta" 
            tuiButton 
            size="s" 
            appearance="primary">
              <tui-icon icon="@tui.grid"/>
              Explore Suite
          </button>
        </div>
      </div>

      <div class="item-actions" footer>
        <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.bookmark" />
            Save Suite
        </button>
         <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.share" />
            Share
        </button>
      </div>
    </content-feed-item>
  `,
  styles: [`
    .item-content {
      padding: 1rem;
    }

    .suite-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .suite-header {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .suite-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .suite-description {
      margin: 0;
      color: var(--tui-text-secondary);
    }

    .suite-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--tui-text-secondary);
    }

    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
    }

    .app-tile {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid var(--tui-border-normal);
      border-radius: 8px;
    }

    .app-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .app-name {
      font-weight: 600;
    }

    .app-description {
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
    }

    .item-actions {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--tui-border-normal);
    }

    .action-btn {
      flex: 1;
    }
  `]
})
export class SuiteTeaserFeedItemComponent {
  @Input() item!: SuiteTeaserFeedItemVM;
}
