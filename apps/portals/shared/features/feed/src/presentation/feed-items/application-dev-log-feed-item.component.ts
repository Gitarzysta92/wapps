import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiChip } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';
import type { ApplicationDevLogFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/app';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { AppChangelogInfoComponent, AppChangelogDetailsComponent } from '@portals/shared/features/changelog';
import { DiscussionChipComponent } from '@portals/shared/features/discussion';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { UpvoteChipComponent, DownvoteChipComponent } from '@ui/voting';
import { VotingContainerDirective, type VotingData } from '@portals/shared/features/voting';

export const APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR = 'application-dev-log-feed-item';

export type ApplicationDevLogFeedItemVM = Omit<ApplicationDevLogFeedItem, never> & {
  appLink: string;
  commentsNumber: number;
  contextMenu: ContextMenuItem[];
  voting: VotingData;
}

@Component({
  selector: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TuiChip,
    TuiIcon,
    MediumCardComponent,
    MediumTitleComponent,
    CardHeaderComponent,
    CardFooterComponent,
    AppAvatarComponent,
    ShareToggleButtonComponent,
    AppChangelogInfoComponent,
    AppChangelogDetailsComponent,
    UpvoteChipComponent,
    DownvoteChipComponent,
    DiscussionChipComponent,
    ContextMenuChipComponent,
    VotingContainerDirective
  ],
  styles: [`
    .changelog-details {
      border: 4px solid #8a2be2;
      margin-top: 1rem;
    }
    .changelog-info {
      padding: 1rem;
      margin-top: 1rem;
    }
    .footer-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
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
      <app-changelog-info
        class="changelog-info"
        [data]="{ version: item.version, releaseDate: item.releaseDate, description: item.description }"
      />
      <ui-medium-card class="changelog-details">
        <tui-chip size="s" appearance="action-soft" slot="top-edge">
          <tui-icon icon="@tui.package-plus" /> What's New
        </tui-chip>
        <app-changelog-details [data]="{ changes: item.changes }" />
      </ui-medium-card>

      <ui-card-footer slot="footer">
        <div
          slot="right-side"
          #votingContainer="votingContainer"
          [votingContainer]="item.voting">
          <upvote-chip
            [count]="votingContainer.upvotesCount()"
            size="xs"
            appearance="action-soft-flat"
            (click)="votingContainer.upvote()"
          />
          <downvote-chip
            [count]="votingContainer.downvotesCount()"
            size="xs"
            appearance="action-soft-flat"
            (click)="votingContainer.downvote()"
          />
        </div>
        <discussion-chip
          slot="right-side"
          [commentsCount]="item.commentsNumber"
          size="xs"
          appearance="action-soft-flat"
        />
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
