import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor, NgIf } from '@angular/common';
import type { SuiteTeaserFeedItem } from '@domains/feed';
import { CardHeaderComponent, MediumCardComponent } from '@ui/layout';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { type ContextMenuItem } from '@ui/context-menu-chip';
import { type AttributionInfoVM } from '@portals/shared/features/attribution';

export const SUITE_TEASER_FEED_ITEM_SELECTOR = 'suite-teaser-feed-item';

export type SuiteTeaserFeedItemVM = Omit<SuiteTeaserFeedItem, never> & {
  suiteLink: string;
  contextMenu: ContextMenuItem[];
  attribution?: AttributionInfoVM;
}

@Component({
  selector: SUITE_TEASER_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MediumCardComponent,
    CardHeaderComponent,
    MediumTitleComponent,
    ShareToggleButtonComponent,
    FavoriteToggleButtonComponent,
    FeedActionsMenuComponent,
    FeedAttributionComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    NgFor,
    NgIf,
    RouterLink
  ],
  styles: [`
    .suite-chip {
      background-color: var(--tui-status-primary);
      color: white;
    }
    .suite-description {
      margin: 0.5rem 0;
      color: var(--tui-text-secondary);
    }
    .suite-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--tui-text-secondary);
      font-size: 0.875rem;
      margin: 0.5rem 0;
    }
    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .app-tile {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid var(--tui-border-normal);
      border-radius: 8px;
      background: var(--tui-background-base);
    }
    .app-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }
    .app-name {
      font-weight: 600;
    }
    .app-description {
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
    }
  `],
  template: `
    <ui-medium-card class="medium-card">
      <tui-chip size="s" appearance="primary" slot="top-edge" class="suite-chip">
        <tui-icon icon="@tui.layout-grid" /> {{ item.category }}
      </tui-chip>
      <ui-card-header slot="header">
        <h3 uiMediumTitle>
          {{ item.suiteTitle }}
        </h3>
        <p class="suite-description">{{ item.suiteDescription }}</p>
        <div class="suite-meta">
          <tui-icon icon="@tui.box" />
          <span>{{ item.apps.length }} Applications</span>
        </div>
      </ui-card-header>

      <div class="apps-grid">
        <div *ngFor="let app of item.apps" class="app-tile">
          <tui-avatar size="l">
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

      @if (item.attribution) { <feed-attribution [title]="item.title" slot="footer" [attribution]="item.attribution" /> }

      <ng-template #cardActions>
        <favorite-toggle-button type="suites" [slug]="suiteSlug" />
        <share-toggle-button
          appearance="action-soft"
          size="s"
          type="suites"
          [slug]="suiteSlug"
          [path]="item.suiteLink"
          [title]="item.suiteTitle"
        />
        <a tuiButton size="s" appearance="primary" [routerLink]="item.suiteLink">
          <tui-icon icon="@tui.grid" />
          Explore Suite
        </a>
        <feed-actions-menu
          [contextMenu]="item.contextMenu"
          [title]="item.title"
          size="xs"
          appearance="action-soft-flat"
        />
      </ng-template>
    </ui-medium-card>
  `,
})
export class SuiteTeaserFeedItemComponent {
  @Input() item!: SuiteTeaserFeedItemVM;
  get suiteSlug(): string { return this.item.suiteLink?.split(/[?#]/)[0].split('/').filter(Boolean).pop() || this.item.suiteTitle.toLowerCase().replace(/\s+/g, '-'); }
}
