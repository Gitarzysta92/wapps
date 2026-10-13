import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import {
  PublicProfileService,
  providePublicProfiles,
  provideProfileBadges,
  provideProfileTotals,
  ProfileTotalsComponent,
  AccountBadgesComponent,
} from '@portals/shared/features/user-profile';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import {
  buildRoutePath,
  type NavigationDeclarationDto,
} from '@portals/shared/boundary/navigation';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ContentStateComponent,
  MediumCardComponent,
  PageHeaderComponent,
  PageTitleComponent,
} from '@ui/layout';
import { RoutedDialogButton } from '@ui/routable-dialog';
import { ProfileDetailsComponent } from './profile-details.component';
import { API_BASE_URL } from '../../environment';
import { NAVIGATION } from '../../navigation';
import type { PublicProfileFavorite } from '@domains/customer/favorites';
import type { ProfileDiscussion } from '@domains/discussion/contracts';
import type {
  ProfileActivity,
  ProfileActivityKind,
} from '@domains/customer/profiles';
import { PreferredDatePipe } from '@portals/shared/features/preferences';

@Component({
  selector: 'public-profile-page',
  standalone: true,
  templateUrl: './public-profile-page.component.html',
  styleUrl: './public-profile-page.component.scss',
  providers: [
    providePublicProfiles(API_BASE_URL),
    provideProfileBadges(API_BASE_URL),
    provideProfileTotals(API_BASE_URL),
  ],
  imports: [
    RouterLink,
    TuiAppearance,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    ProfileDetailsComponent,
    BreadcrumbsComponent,
    ContentStateComponent,
    MediumCardComponent,
    PageHeaderComponent,
    PageTitleComponent,
    RoutedDialogButton,
    PreferredDatePipe,
    AccountBadgesComponent,
    ProfileTotalsComponent,
  ],
})
export class PublicProfilePageComponent {
  readonly activityLabels: Record<ProfileActivityKind, string> = {
    application: 'Published an application',
    suite: 'Published a suite',
    article: 'Published an article',
    release: 'Published a release',
    discussion: 'Started a discussion',
    reply: 'Replied to a discussion',
    comment: 'Commented on an article',
    review: 'Published a review',
    'favorite-application': 'Saved an application',
    'favorite-suite': 'Saved a suite',
    'favorite-article': 'Saved an article',
    'favorite-discussion': 'Saved a discussion',
  };
  readonly profiles = inject(PublicProfileService);
  private readonly own = inject(MY_PROFILE_VIEW_STATE_PROVIDER);
  readonly canRequest = computed(() => !!this.own.state().data?.name);
  readonly title = computed(
    () =>
      this.profiles.profile()?.profile?.name ??
      (this.profiles.status() === 'missing'
        ? 'Profile unavailable'
        : 'Community profile')
  );
  readonly breadcrumbs = computed<NavigationDeclarationDto[]>(() => [
    NAVIGATION.home,
    { label: this.title(), path: '', icon: '@tui.user-round' },
  ]);

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.profiles.open(params.get('profileId') ?? ''));
  }
  profilePath(id: string): string {
    return buildRoutePath(
      NAVIGATION.userProfile.path,
      { profileId: id },
      { absolute: true }
    );
  }
  activityPath(item: ProfileActivity): string | string[] {
    const target = item.target;
    if (target.kind === 'release')
      return [
        buildRoutePath(
          NAVIGATION.applicationDevLog.path,
          { appSlug: target.applicationSlug },
          { absolute: true }
        ),
        target.version,
      ];
    const path =
      target.kind === 'suite'
        ? NAVIGATION.suite.path
        : target.kind === 'article' || target.kind === 'comment'
        ? NAVIGATION.article.path
        : target.kind === 'application'
        ? NAVIGATION.applicationOverview.path
        : target.kind === 'review'
        ? NAVIGATION.applicationReview.path
        : NAVIGATION.applicationDiscussion.path;
    return buildRoutePath(
      path,
      {
        appSlug:
          'applicationSlug' in target
            ? target.applicationSlug
            : 'slug' in target
            ? target.slug
            : '',
        articleSlug:
          'articleSlug' in target
            ? target.articleSlug
            : 'slug' in target
            ? target.slug
            : '',
        suiteSlug: target.id,
        reviewSlug: target.id,
        discussionSlug: target.id,
      },
      { absolute: true }
    );
  }
  favoritePath(item: PublicProfileFavorite): string {
    const route =
      item.kind === 'applications'
        ? NAVIGATION.applicationOverview
        : item.kind === 'articles'
        ? NAVIGATION.article
        : item.kind === 'suites'
        ? NAVIGATION.suite
        : NAVIGATION.applicationDiscussion;
    return buildRoutePath(
      route.path,
      {
        appSlug: item.applicationSlug ?? item.slug,
        articleSlug: item.slug,
        suiteSlug: item.id,
        discussionSlug: item.id,
      },
      { absolute: true }
    );
  }
  articlePath(slug: string): string {
    return buildRoutePath(
      NAVIGATION.article.path,
      { articleSlug: slug },
      { absolute: true }
    );
  }
  suitePath(id: string): string {
    return buildRoutePath(
      NAVIGATION.suite.path,
      { suiteSlug: id },
      { absolute: true }
    );
  }
  discussionPath(item: ProfileDiscussion): string {
    return buildRoutePath(
      item.parentKind === 'application'
        ? NAVIGATION.applicationDiscussion.path
        : NAVIGATION.article.path,
      {
        appSlug: item.parentSlug,
        articleSlug: item.parentSlug,
        discussionSlug: item.id,
      },
      { absolute: true }
    );
  }
}
