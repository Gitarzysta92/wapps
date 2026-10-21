import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge, TuiChip } from '@taiga-ui/kit';
import type { ExploreItem } from '@domains/feed';
import {
  CardHeaderComponent,
  MediumCardComponent,
  ElevatedCardComponent,
} from '@ui/layout';
import { MediumTitleComponent, ExcerptComponent } from '@ui/content';
import { CoverImageComponent } from '@ui/cover-image';
import {
  DiscussionThreadComponent,
  DiscussionPostComponent,
  DiscussionPostHeaderComponent,
  DiscussionExpandablePostContentComponent,
} from '@ui/discussion';
import {
  AppAvatarComponent,
  AppRatingComponent,
  AppCategoryChipComponent,
  AppReviewsChipComponent,
} from '@portals/shared/features/application-overview';
import { QuickDiscussionButtonComponent } from '@portals/shared/features/discussion';
import {
  ArticleCoverImageComponent,
  ArticleDetailsBadgeComponent,
  provideArticleCovers,
} from '@portals/shared/features/articles';
import {
  ReviewAuthorBadgeComponent,
  ReviewQuoteShortComponent,
} from '@portals/shared/features/review';
import { AppChangelogDetailsComponent } from '@portals/shared/features/changelog';
import { TagsComponent } from '@ui/tags';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { EXPLORE_LINK } from '../../application/explore.port';

@Component({
  selector: 'activity-feed-card',
  providers: [provideArticleCovers()],
  imports: [
    RouterLink,
    TuiButton,
    TuiIcon,
    CardHeaderComponent,
    MediumCardComponent,
    MediumTitleComponent,
    TagsComponent,
    FavoriteToggleButtonComponent,
    ShareToggleButtonComponent,
    PreferredDatePipe,
    NgTemplateOutlet,
    TuiAvatar,
    TuiBadge,
    TuiChip,
    ElevatedCardComponent,
    ExcerptComponent,
    CoverImageComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppCategoryChipComponent,
    AppReviewsChipComponent,
    QuickDiscussionButtonComponent,
    ArticleCoverImageComponent,
    ArticleDetailsBadgeComponent,
    ReviewAuthorBadgeComponent,
    ReviewQuoteShortComponent,
    AppChangelogDetailsComponent,
    DiscussionThreadComponent,
    DiscussionPostComponent,
    DiscussionPostHeaderComponent,
    DiscussionExpandablePostContentComponent,
  ],
  templateUrl: './activity-card.component.html',
  styleUrl: './activity-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityCardComponent {
  readonly item = input.required<ExploreItem>();
  private readonly resolveLink = inject(EXPLORE_LINK);
  private readonly router = inject(Router);
  readonly destination = computed(() => this.resolveLink(this.item().target));
  readonly path = computed(() => {
    const destination = this.destination();
    return this.router.serializeUrl(
      this.router.createUrlTree(
        Array.isArray(destination.path) ? destination.path : [destination.path],
        { queryParams: destination.query }
      )
    );
  });
  readonly date = computed(() => new Date(this.item().at).toISOString());
  readonly Math = Math;
  readonly article = computed(() => {
    const details = this.item().details;
    return details?.kind === 'article' ? details : null;
  });
  readonly application = computed(() => {
    const details = this.item().details;
    return details?.kind === 'application' ? details : null;
  });
  readonly suite = computed(() => {
    const details = this.item().details;
    return details?.kind === 'suite' ? details : null;
  });
  readonly release = computed(() => {
    const details = this.item().details;
    return details?.kind === 'release' ? details : null;
  });
  readonly review = computed(() => {
    const details = this.item().details;
    return details?.kind === 'review' ? details : null;
  });
  readonly discussion = computed(() => {
    const details = this.item().details;
    return details?.kind === 'discussion' ? details : null;
  });
  readonly releaseVersion = computed(() => {
    const target = this.item().target;
    return target.kind === 'release' ? target.version : '';
  });
  readonly discussionTarget = computed(() => {
    const target = this.item().target;
    return target.kind === 'discussion' ? target : null;
  });
  readonly reviewsPath = computed(() => {
    const target = this.item().target;
    if (target.kind !== 'application') return '';
    const link = this.resolveLink({
      kind: 'application-reviews',
      applicationSlug: target.slug,
    });
    return this.router.serializeUrl(
      this.router.createUrlTree(
        Array.isArray(link.path) ? link.path : [link.path],
        { queryParams: link.query }
      )
    );
  });
  readonly share = computed(() => {
    const target = this.item().target;
    return (
      this.favorite() ??
      ('applicationSlug' in target
        ? { type: 'applications' as const, slug: target.applicationSlug }
        : null)
    );
  });
  memberLink(id: string, slug: string) {
    return this.resolveLink({ kind: 'application', id, slug });
  }
  iso(at: number) {
    return new Date(at).toISOString();
  }
  readonly favorite = computed(() => {
    const target = this.item().target;
    switch (target.kind) {
      case 'application':
        return { type: 'applications' as const, slug: target.slug };
      case 'article':
        return { type: 'articles' as const, slug: target.slug };
      case 'suite':
        return { type: 'suites' as const, slug: target.id };
      case 'discussion':
        return { type: 'discussions' as const, slug: target.id };
      default:
        return null;
    }
  });
  readonly presentation = computed(
    () =>
      ({
        application: {
          label: 'Application update',
          icon: '@tui.box',
          action: 'View application',
        },
        article: {
          label: 'Article',
          icon: '@tui.book-open-text',
          action: 'Read article',
        },
        suite: {
          label: 'Suite',
          icon: '@tui.layout-grid',
          action: 'View suite',
        },
        release: {
          label: 'Development log',
          icon: '@tui.git-commit',
          action: 'View release',
        },
        discussion: {
          label: 'Discussion',
          icon: '@tui.messages-square',
          action: 'Read discussion',
        },
        review: {
          label: 'Member review',
          icon: '@tui.star',
          action: 'Read review',
        },
      }[this.item().kind])
  );
}
