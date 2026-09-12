import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { FeedDatePipe } from '../actions/feed-date.pipe';
import { FeedLocalVoteComponent } from '../actions/feed-local-vote.component';
import { RouterLink } from '@angular/router';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiBadge, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ApplicationDevLogFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/application-overview';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { AppChangelogDetailsComponent } from '@portals/shared/features/changelog';
import { type ContextMenuItem } from '@ui/context-menu-chip';
import { type VotingData } from '@portals/shared/features/voting';
import { type AttributionInfoVM } from '@portals/shared/features/attribution';

//TODO: this has to be changed to application-changelog-feed-item


export const APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR = 'application-dev-log-feed-item';

export type ApplicationDevLogFeedItemVM = Omit<ApplicationDevLogFeedItem, never> & {
  appLink: string;
  commentsNumber: number;
  contextMenu: ContextMenuItem[];
  voting?: VotingData;
  attribution?: AttributionInfoVM;
}

@Component({
  selector: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FeedDatePipe,
    FeedLocalVoteComponent,
    RouterLink,
    TuiButton,
    TuiChip,
    TuiIcon,
    TuiBadge,
    MediumCardComponent,
    MediumTitleComponent,
    CardHeaderComponent,
    CardFooterComponent,
    AppAvatarComponent,
    ShareToggleButtonComponent,
    AppChangelogDetailsComponent,
    FeedActionsMenuComponent,
    FeedAttributionComponent
  ],
  styles: [`
    .changelog-details {
      border: 4px solid #8a2be2;
      margin-top: 1rem;
    }
    .changelog-info {
      padding: 1rem;
    }
    .changelog-label {
      display: inline-flex;
      align-items: center;
      opacity: 0.5;
      margin-left: 0.5rem;
    }
    .changelog-badge {
      background-color: #8a2be2;
      color: white;
    }
    .changelog-version {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      small {
        opacity: 0.5;
      }
    }
  `],
  template: `
    <ui-medium-card class="medium-card">
      <ui-card-header slot="header">
        <app-avatar
          slot="left-side"
          [size]="'m'"
          [avatar]="{ url: 'https://picsum.photos/200', alt: item.appName }"/>
        <h3 uiMediumTitle>
          {{ item.appName }}
          <span class="changelog-label">
            changelog <tui-icon [style.height]="'16px'" icon="@tui.git-commit" />
          </span>
        </h3>
        <div class="changelog-version">
          <tui-badge class="changelog-badge" size="s">ver. {{ item.version }}</tui-badge> <small>{{ item.subtitle }}</small>
        </div>
        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="applications"
          [slug]="item.appSlug" [path]="item.appLink"
          [title]="item.appName"
        />
        <a tuiButton appearance="action-soft" size="s" slot="right-side" [routerLink]="item.appLink" [attr.aria-label]="'View application: ' + item.title"><tui-icon icon="@tui.circle-arrow-right" aria-hidden="true" />View application</a>
      </ui-card-header>
      <section class="changelog-info"><p>Version {{ item.version }} · {{ item.releaseDate | feedDate }}</p><p>{{ item.description }}</p></section>
      <ui-medium-card class="changelog-details">
        <tui-chip size="s" appearance="action-soft" slot="top-edge">
          <tui-icon icon="@tui.package-plus" /> What's New
        </tui-chip>
        <app-changelog-details [data]="{ changes: item.changes }" />
      </ui-medium-card>

      <ui-card-footer slot="footer">
        @if (item.attribution) { <feed-attribution [title]="item.title" slot="left-side" [attribution]="item.attribution" /> }
        <feed-local-vote slot="right-side" [itemId]="item.id" [title]="item.title" [upvotes]="item.voting?.upvotes || 0" [downvotes]="item.voting?.downvotes || 0" />
        <a tuiButton size="xs" appearance="flat" slot="right-side" [routerLink]="['/apps', item.appSlug, 'discussions']" [attr.aria-label]="'Open discussions for ' + item.title">Discussions ({{ item.commentsNumber || 0 }})</a>
        <feed-actions-menu
          slot="right-side"
          [contextMenu]="item.contextMenu" [title]="item.title"
          size="xs"
          appearance="action-soft-flat"
        />
      </ui-card-footer>
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
