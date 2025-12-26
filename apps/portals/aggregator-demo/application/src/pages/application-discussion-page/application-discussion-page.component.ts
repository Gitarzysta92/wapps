import { Component, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of, delay } from 'rxjs';
import { TuiAvatar, TuiBadge } from '@taiga-ui/kit';
import { 
  DiscussionPostComponent, 
  DiscussionThreadComponent,
  DiscussionPostHeaderComponent,
  DiscussionExpandablePostContentComponent,
  DiscussionVotingButtonComponent,
  DiscussionReplyButtonComponent,
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
    CommonModule,
    SlicePipe,
    TuiAppearance,
    TuiAvatar,
    TuiBadge,
    TuiIcon,
    DiscussionThreadComponent,
    DiscussionPostComponent,
    DiscussionPostHeaderComponent,
    DiscussionExpandablePostContentComponent,
    DiscussionVotingButtonComponent,
    DiscussionReplyButtonComponent,
    DiscussionThreadSkeletonComponent,
    DiscussionStatsBadgeComponent,
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
      return of(app).pipe(delay(1500));
    }
  });

  public readonly discussion = rxResource({
    request: () => this.discussionSlug(),
    loader: ({ request: discussionSlug }) => {
      const discussion = DISCUSSIONS.find(d => d.slug === discussionSlug) ?? null;
      return of(discussion).pipe(delay(1000));
    }
  });

  public readonly relatedDiscussions = rxResource({
    request: () => this.discussionSlug(),
    loader: ({ request: discussionSlug }) => {
      const discussion = DISCUSSIONS.filter(d => d.slug !== discussionSlug) ?? null;
      return of(discussion).pipe(delay(1000));
    }
  });

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
    const breadcrumb = this.breadcrumb();
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
