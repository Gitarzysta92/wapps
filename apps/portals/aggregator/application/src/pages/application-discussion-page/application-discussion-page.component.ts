import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { LOCAL_APPLICATION_DATA, LocalDiscussionsService } from '@portals/shared/features/application-overview';
import { Component, computed, input, inject, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { TuiAvatar, TuiSkeleton } from '@taiga-ui/kit';
import { DividerComponent, ContentStateComponent } from '@ui/layout';
import { 
  DiscussionPostComponent, 
  DiscussionThreadComponent,
  DiscussionPostHeaderComponent,
  DiscussionExpandablePostContentComponent,
  DiscussionThreadSkeletonComponent,
} from '@ui/discussion';
import { DiscussionStatsBadgeComponent } from '@portals/shared/features/discussion';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from "@ui/breadcrumbs";
import { 
  PageHeaderComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent, 
  PageMetaComponent, 
  PageMetaSkeletonComponent,
  MediumCardComponent,
  MediumCardSkeletonComponent,
  CardHeaderComponent
} from "@ui/layout";
import { TuiAppearance, TuiIcon } from '@taiga-ui/core';
import { SlicePipe } from '@angular/common';
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS, DISCUSSIONS } from '@portals/shared/data';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';
import { TagsComponent, TagsSkeletonComponent } from '@ui/tags';
import { replaceBreadcrumbLabels } from '../../utils/breadcrumb.utils';

@Component({
  selector: 'app-discussion-page',
  standalone: true,
  imports: [
    ContentStateComponent,
    CommonModule, FormsModule, RouterLink, TuiButton,
    SlicePipe,
    TuiAppearance,
    TuiAvatar, TuiSkeleton, DividerComponent,
    TuiIcon,
    DiscussionThreadComponent,
    DiscussionPostComponent,
    DiscussionPostHeaderComponent,
    DiscussionExpandablePostContentComponent,
    DiscussionThreadSkeletonComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    PageMetaSkeletonComponent,
    MediumCardComponent,
    MediumCardSkeletonComponent,
    CardHeaderComponent,
    TagsComponent,
    TagsSkeletonComponent
  ],
  templateUrl: './application-discussion-page.component.html',
  styleUrl: './application-discussion-page.component.scss'
})
export class ApplicationDiscussionPageComponent implements
  routingDataConsumerFrom<IBreadcrumbRouteData & { discussionSlug: string | null }> {

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly discussionSlug = input<string | null>(null);
  public readonly appSlug = input<string | null>(null);
  
  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug) ?? null;
      return of(app);
    }
  });

  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  readonly localData = inject(LocalDiscussionsService);
  readonly composing = signal(false);
  replyContent = '';
  saveError = '';
  constructor() { effect(() => { this.appSlug(); this.discussionSlug(); this.composing.set(false); this.replyContent = ''; this.saveError = ''; }); }
  readonly discussion = {
    isLoading: () => this.app.isLoading(),
    value: computed(() => this.localData.threads(this.appSlug()).find(d => d.slug === this.discussionSlug()) ?? null)
  };
  readonly relatedDiscussions = {
    isLoading: () => this.app.isLoading(),
    value: computed(() => this.localData.threads(this.appSlug()).filter(d => d.slug !== this.discussionSlug()))
  };
  saveReply() {
    if (!this.localMode || !this.appSlug() || !this.discussionSlug()) return;
    try {
      this.localData.reply(this.appSlug()!, this.discussionSlug()!, this.replyContent);
      this.replyContent = '';
      this.composing.set(false);
      this.saveError = '';
    } catch { this.saveError = 'Could not save on this device. Check your text and browser storage, then try again.'; }
  }

  // Derive top authors from discussions
  public readonly topAuthors = computed(() => {
    const discussions = this.relatedDiscussions.value() ?? [];
    const currentDiscussion = this.discussion.value();
    const allDiscussions = currentDiscussion 
      ? [...discussions, currentDiscussion] 
      : discussions;
    
    const authorMap = new Map<string, { 
      id: string; 
      name: string; 
      slug: string;
      avatar: { url: string }; 
      postsCount: number; 
      likesCount: number;
    }>();

    // Collect unique authors with aggregated stats
    for (const discussion of allDiscussions) {
      const author = discussion.author;
      const existing = authorMap.get(author.id);
      
      if (!existing) {
        authorMap.set(author.id, {
          ...author,
          postsCount: 1,
          likesCount: discussion.upvotesCount ?? 0,
        });
      } else {
        existing.postsCount += 1;
        existing.likesCount += discussion.upvotesCount ?? 0;
      }
    }

    // Sort by likes and return top 3
    return Array.from(authorMap.values())
      .sort((a, b) => b.likesCount - a.likesCount)
      .slice(0, 3);
  });

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb().map(item => ({ ...item, path: '/' + item.path.replace(/^\/+/, '').replace(':appSlug', encodeURIComponent(this.appSlug() ?? '')).replace(':discussionSlug', encodeURIComponent(this.discussionSlug() ?? '')) }));
    const discussion = this.discussion.value();
    const app = this.app.value();
    
    const replacements: Record<string, string> = {};
    
    if (discussion) {
      replacements[NAVIGATION_NAME_PARAMS.discussionName] = discussion.title ?? 'Unknown Discussion';
    }
    
    if (app) {
      replacements[NAVIGATION_NAME_PARAMS.applicationName] = app.name ?? 'Unknown Application';
    }
    
    return replaceBreadcrumbLabels(breadcrumb, replacements);
  });
}
