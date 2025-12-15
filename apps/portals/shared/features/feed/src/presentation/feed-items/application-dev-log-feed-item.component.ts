import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationDevLogFeedItem } from '@domains/feed';
import { CardHeaderComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/app';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';

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
    RoutePathPipe,
    MediumCardComponent,
    MediumTitleComponent,
    CardHeaderComponent,
    AppAvatarComponent,
    ShareToggleButtonComponent
  ],
  styles: [`
    .medium-card-nested {
      padding: 1rem;
      background-color: #8a2be2;
      border-radius: $radius-sm;
      box-shadow: $shadow-md;
      margin-top: 1rem;
    }
  `],
  template: `
    <ui-medium-card class="medium-card">
      <ui-card-header slot="title">
        <app-avatar
          slot="left-side"
          [size]="'m'"
          [avatar]="{ url: 'https://picsum.photos/200', alt: item.appName }"/>
        <h3 uiMediumTitle>
          {{ item.appName }} <tui-chip size="s">major update - {{ item.version }}</tui-chip>
        </h3>
        <small>
          {{ item.subtitle }}
        </small>
        <share-toggle-button
          slot="right-side"
          type="applications"
          slug="item.appSlug"
          title="item.appName"
        />
      </ui-card-header>
      <div class="version-column">
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
      <ui-medium-card class="medium-card-nested">
        <tui-chip size="s" appearance="action-soft" slot="top-edge">
          <tui-icon icon="@tui.list" /> What's New
        </tui-chip>
        <ul class="changes-list">
          <li *ngFor="let change of item.changes" class="change-item">
            <tui-icon icon="@tui.check" class="check-icon" />
            <span>{{ change.description }}</span>
          </li>
        </ul>
      </ui-medium-card>

      <div class="item-content" content>
        <div class="dev-log-container">
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

      <div slot="footer">
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

    </ui-medium-card>
  `,
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
