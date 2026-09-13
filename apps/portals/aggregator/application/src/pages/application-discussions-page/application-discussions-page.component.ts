import { FormsModule } from '@angular/forms';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { Component, inject, computed, input, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
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
  NoticeCardComponent,
  ContentStateComponent
} from '@ui/layout';
import { buildRoutePath, IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS, DISCUSSION_PREVIEW_DATA } from '@portals/shared/data';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';
import { 
  DiscussionSmallCardComponent, 
  DiscussionMediumCardComponent, 
  DiscussionSmallCardSkeletonComponent,
  DiscussionMediumCardSkeletonComponent,
} from '@portals/shared/features/discussion';
import type { DiscussionPreviewDto } from '@domains/discussion';
import { replaceBreadcrumbLabels } from '../../utils/breadcrumb.utils';


@Component({
  selector: 'app-application-discussions-page',
  standalone: true,
  imports: [
    RouterLink,
    ContentStateComponent,
    CommonModule, FormsModule,
    TuiButton,
    TuiIcon,
    TuiAppearance,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    DiscussionSmallCardComponent,
    DiscussionMediumCardComponent,
    DiscussionSmallCardSkeletonComponent,
    DiscussionMediumCardSkeletonComponent,
    CommonSectionComponent,
    SectionHeaderComponent,
    SectionTitleComponent,
    NoticeCardComponent
  ],
  templateUrl: './application-discussions-page.component.html',
  styleUrl: './application-discussions-page.component.scss',
})
export class ApplicationDiscussionsPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  readonly localData = inject(LocalDiscussionsService);
  readonly composing = signal(false);
  title = '';
  content = '';
  error = '';
  constructor() { effect(() => { this.appSlug(); this.composing.set(false); this.title = ''; this.content = ''; this.error = ''; }); }
  saveDiscussion() {
    if (!this.localMode || !this.appSlug()) return;
    try {
      const thread = this.localData.create(this.appSlug()!, this.title, this.content);
      this._router.navigateByUrl(buildRoutePath('/' + NAVIGATION.applicationDiscussion.path, { appSlug: this.appSlug(), discussionSlug: thread.slug }));
    } catch { this.error = 'Could not save on this device. Check your text and browser storage, then try again.'; }
  }
  private readonly _router = inject(Router);

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug);
      return of(app);
    }
  });

  public readonly discussions = {
    isLoading: () => this.app.isLoading(),
    value: computed(() => this.localData.previews(this.appSlug()))
  };

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
    const breadcrumb = this.breadcrumb().map(item => ({ ...item, path: '/' + item.path.replace(/^\/+/, '').replace(':appSlug', encodeURIComponent(this.appSlug() ?? '')) }));
    const app = this.app.value();
    
    const replacements: Record<string, string> = {};
    
    if (app) {
      replacements[NAVIGATION_NAME_PARAMS.applicationName] = app.name ?? 'Unknown Application';
    }
    
    return replaceBreadcrumbLabels(breadcrumb, replacements);
  });


  public navigateToDiscussion(discussion: DiscussionPreviewDto): void {
    const appSlug = this.appSlug();
    this._router.navigate([buildRoutePath('/' + NAVIGATION.applicationDiscussion.path, { appSlug, discussionSlug: discussion.slug })]);
  }

}
