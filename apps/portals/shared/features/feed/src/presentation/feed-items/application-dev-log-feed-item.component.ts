import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationDevLogFeedItem } from '@domains/feed';

export const APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR = 'application-dev-log-feed-item';

export type ApplicationDevLogFeedItemVM = Omit<ApplicationDevLogFeedItem, never> & {
  appLink: string;
}

@Component({
  selector: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgFor,
    RouterLink,
    RoutePathPipe
  ],
  template: `
    <content-feed-item
      icon="@tui.git-commit"
      [item]="item">
      <div class="item-content" content>
        <div class="dev-log-container">
          <tui-chip 
            class="change-type-chip" 
            [appearance]="changeType === 'major' ? 'error' : changeType === 'minor' ? 'primary' : 'neutral'"
            size="s">
            {{ changeTypeLabel }}
          </tui-chip>

          <div class="dev-log-columns">
            <!-- First Column: Version and Description -->
            <div class="version-column">
              <div class="app-name">{{ item.appName }}</div>
              <div class="version-header">
                <tui-icon icon="@tui.tag" class="version-icon" />
                <h3 class="version-number">Version {{ item.version }}</h3>
              </div>
              <div class="release-date">
                <tui-icon icon="@tui.calendar" class="date-icon" />
                <span>{{ item.releaseDate }}</span>
              </div>
              <p class="version-description">{{ item.description }}</p>
            </div>

            <!-- Second Column: Changes List -->
            <div class="changes-column">
              <h4 class="changes-title">
                <tui-icon icon="@tui.list" />
                What's New
              </h4>
              <ul class="changes-list">
                <li *ngFor="let change of item.changes" class="change-item">
                  <tui-icon icon="@tui.check" class="check-icon" />
                  <span>{{ change.description }}</span>
                </li>
              </ul>
            </div>
          </div>

          <a
            class="dev-log-cta" 
            tuiButton 
            size="s" 
            appearance="primary"
            [routerLink]="ctaPath | routePath:{ appSlug: item.appSlug }">
              <tui-icon icon="@tui.external-link"/>
              View Full Changelog
          </a>
        </div>
      </div>

      <div class="item-actions" footer>
        <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.download" />
            Update Now
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

    .dev-log-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .dev-log-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .version-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .app-name {
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
    }

    .version-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .version-number {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .release-date {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--tui-text-secondary);
    }

    .version-description {
      margin: 0;
      color: var(--tui-text-secondary);
    }

    .changes-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .changes-title {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .changes-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .change-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .check-icon {
      color: var(--tui-status-positive);
      flex-shrink: 0;
      margin-top: 0.125rem;
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
export class ApplicationDevLogFeedItemComponent {
  @Input() item!: ApplicationDevLogFeedItemVM;
  @Input() ctaPath = '';

  get changeType(): 'major' | 'minor' | 'patch' {
    return (this.item.changes[0]?.type as 'major' | 'minor' | 'patch') || 'patch';
  }

  get changeTypeLabel(): string {
    switch (this.changeType) {
      case 'major': return 'Major Update';
      case 'minor': return 'Minor Update';
      case 'patch': return 'Patch';
      default: return 'Update';
    }
  }
}
