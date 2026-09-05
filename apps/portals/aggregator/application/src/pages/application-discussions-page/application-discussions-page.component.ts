import { Component, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { of, delay } from 'rxjs';
import { TuiButton, TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { 
  PageHeaderComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent,
  PageMetaComponent,
  CommonSectionComponent,
  SectionHeaderComponent,
  SectionTitleComponent,
  DividerComponent,
  NoticeCardComponent
} from '@ui/layout';
import { buildRoutePath, IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS, DISCUSSION_PREVIEW_DATA } from '@portals/shared/data';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';
import { 
  DiscussionSmallCardComponent, 
  DiscussionMediumCardComponent, 
  DiscussionSmallCardSkeletonComponent,
  DiscussionMediumCardSkeletonComponent,
  DiscussionsStatsBadgeComponent 
} from '@portals/shared/features/discussion';
import type { DiscussionPreviewDto } from '@domains/discussion';
import { replaceBreadcrumbLabels } from '../../utils/breadcrumb.utils';


@Component({
  selector: 'app-application-discussions-page',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiBadge,
    TuiAppearance,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    DiscussionsStatsBadgeComponent,
    DiscussionSmallCardComponent,
    DiscussionMediumCardComponent,
    DiscussionSmallCardSkeletonComponent,
    DiscussionMediumCardSkeletonComponent,
    CommonSectionComponent,
    SectionHeaderComponent,
    SectionTitleComponent,
    DividerComponent,
    NoticeCardComponent
  ],
  templateUrl: './application-discussions-page.component.html',
  styleUrl: './application-discussions-page.component.scss',
})
export class ApplicationDiscussionsPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  private readonly _router = inject(Router);

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug);
      return of(app).pipe(delay(1000));
    }
  });

  public readonly discussions = rxResource({
    request: () => this.app.value(),
    loader: ({ request: app }) => {
      const discussions = DISCUSSION_PREVIEW_DATA.filter(d => d.associationId === app?.id);
      return of(discussions).pipe(delay(1200))
    }
  });

  public readonly totalStats = computed(() => {
    const discussionList = this.discussions.value() ?? [];
    return {
      topics: discussionList.length,
      totalReplies: discussionList.reduce((sum, d) => sum + d.repliesCount, 0),
      totalViews: discussionList.reduce((sum, d) => sum + d.viewsCount, 0)
    };
  });

  public readonly pinnedDiscussions = computed(() => {
    return (this.discussions.value() ?? []).filter(d => d.isPinned);
  });

  public readonly unpinnedDiscussions = computed(() => {
    return (this.discussions.value() ?? []).filter(d => !d.isPinned);
  });

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb();
    const app = this.app.value();
    
    const replacements: Record<string, string> = {};
    
    if (app) {
      replacements[NAVIGATION_NAME_PARAMS.applicationName] = app.name ?? 'Unknown Application';
    }
    
    return replaceBreadcrumbLabels(breadcrumb, replacements);
  });


  public navigateToDiscussion(discussion: DiscussionPreviewDto): void {
    const appSlug = this.appSlug();
    this._router.navigate([buildRoutePath(NAVIGATION.applicationDiscussion.path, { appSlug, discussionSlug: discussion.slug })]);
  }

}
