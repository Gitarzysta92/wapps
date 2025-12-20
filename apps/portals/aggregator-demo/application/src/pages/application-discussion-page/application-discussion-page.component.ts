import { Component, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of, delay } from 'rxjs';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { 
  DiscussionPostComponent, 
  DiscussionThreadComponent,
  DiscussionPostHeaderComponent,
  DiscussionExpandablePostContentComponent,
  DiscussionVotingButtonComponent,
  DiscussionReplyButtonComponent,
} from '@ui/discussion';
import { DiscussionStatsBadgeComponent } from '@portals/shared/features/discussion';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from "@ui/breadcrumbs";
import { 
  PageHeaderComponent, 
  PageHeaderSkeletonComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent, 
  PageMetaComponent, 
  PageMetaSkeletonComponent 
} from "@ui/layout";
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS, DISCUSSIONS } from '@portals/shared/data';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';
import { TagsComponent, TagsSkeletonComponent } from '@ui/tags';

@Component({
  selector: 'app-discussion-page',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiBadge,
    DiscussionThreadComponent,
    DiscussionPostComponent,
    DiscussionPostHeaderComponent,
    DiscussionExpandablePostContentComponent,
    DiscussionVotingButtonComponent,
    DiscussionReplyButtonComponent,
    DiscussionStatsBadgeComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageHeaderSkeletonComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    PageMetaSkeletonComponent,
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
      return of(app).pipe(delay(1500)); // Simulate network delay
    }
  });

  public readonly discussion = rxResource({
    request: () => this.discussionSlug(),
    loader: ({ request: discussionSlug }) => {
      const discussion = DISCUSSIONS.find(d => d.slug === discussionSlug) ?? null;
      return of(discussion).pipe(delay(1000)); // Simulate network delay
    }
  });

  // TODO: move to a utility function
  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb();
    
    if (this.discussion.value() && this.app.value()) { 
      return breadcrumb.map((breadcrumb) => {
        if (breadcrumb.label.includes(NAVIGATION_NAME_PARAMS.discussionName)) {
          return {
            ...breadcrumb,
            label: breadcrumb.label.replace(NAVIGATION_NAME_PARAMS.discussionName, this.discussion.value()?.title ?? 'Unknown Discussion')
          };
        }
        if (breadcrumb.label.includes(NAVIGATION_NAME_PARAMS.applicationName)) {
          return {
            ...breadcrumb,
            label: breadcrumb.label.replace(NAVIGATION_NAME_PARAMS.applicationName, this.app.value()?.name ?? 'Unknown Application')
          };
        }
        return breadcrumb;
      });
    } else {
      return breadcrumb;
    }
  });
}
