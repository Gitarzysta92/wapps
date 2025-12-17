import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor, NgIf } from '@angular/common';
import type { SuiteTeaserFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { MyFavoriteToggleComponent } from '@portals/shared/features/my-favorites';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';

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
    CardFooterComponent,
    MediumTitleComponent,
    ShareToggleButtonComponent,
    MyFavoriteToggleComponent,
    ContextMenuChipComponent,
    AttributionInfoBadgeComponent,
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
        <my-favorite-toggle
          appearance="action-soft"
          slot="right-side"
          [item]="item.id"
          size="s"
        />
        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="suites"
          [slug]="item.id"
          [title]="item.suiteTitle"
        />
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

      <a
        tuiButton 
        size="s" 
        appearance="primary"
        [routerLink]="item.suiteLink">
          <tui-icon icon="@tui.grid"/>
          Explore Suite
      </a>

      <ui-card-footer slot="footer">
        <attribution-info-badge slot="left-side" [attribution]="item.attribution" />
        <context-menu-chip
          slot="right-side"
          [contextMenu]="item.contextMenu"
          size="xs"
          appearance="action-soft-flat"
        />
      </ui-card-footer>
    </ui-medium-card>
  `,
})
export class SuiteTeaserFeedItemComponent {
  @Input() item!: SuiteTeaserFeedItemVM;
}
