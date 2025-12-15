import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationDevLogFeedItem } from '@domains/feed';
import { CardHeaderComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/app';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { AppChangelogInfoComponent, AppChangelogDetailsComponent } from '@portals/shared/features/changelog';

export const APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR = 'application-dev-log-feed-item';

export type ApplicationDevLogFeedItemVM = Omit<ApplicationDevLogFeedItem, never> & {
  appLink: string;
}

@Component({
  selector: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiChip,
    TuiButton,
    TuiIcon,
    RouterLink,
    RoutePathPipe,
    MediumCardComponent,
    MediumTitleComponent,
    CardHeaderComponent,
    AppAvatarComponent,
    ShareToggleButtonComponent,
    AppChangelogInfoComponent,
    AppChangelogDetailsComponent
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
      <app-changelog-info [version]="item.version" [releaseDate]="item.releaseDate" [description]="item.description" />
      <ui-medium-card class="medium-card-nested">
        <tui-chip size="s" appearance="action-soft" slot="top-edge">
          <tui-icon icon="@tui.list" /> What's New
        </tui-chip>
        <app-changelog-details [changes]="item.changes" />
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
