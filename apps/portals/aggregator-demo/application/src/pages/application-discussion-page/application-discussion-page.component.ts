import { Component, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, shareReplay } from 'rxjs';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { AppRecordDto } from '@domains/catalog/record';
import { 
  DiscussionPostComponent, 
  DiscussionThreadComponent,
  DiscussionPostHeaderComponent,
  DiscussionExpandablePostContentComponent,
  DiscussionVotingButtonComponent,
  DiscussionReplyButtonComponent,
  type DiscussionPostVM
} from '@ui/discussion';
import { BreadcrumbsComponent } from "@ui/breadcrumbs";
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';

interface DiscussionTopic {
  id: string;
  title: string;
  author: string;
  authorAvatar: string;
  createdAt: Date;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  tags: string[];
  content: string;
}

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
    BreadcrumbsComponent
  ],
  templateUrl: './application-discussion-page.component.html',
  styleUrl: './application-discussion-page.component.scss'
})
export class ApplicationDiscussionPageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly _route = inject(ActivatedRoute);
  public readonly app$ = this._route.paramMap.pipe(
    map(p => p.get('appSlug') ?? 'unknown'),
    map(slug => this._buildMockFromSlug(slug)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  public readonly topic$ = this._route.paramMap.pipe(
    map(() => this._getTopicFromSlug()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  private _buildMockFromSlug(slug: string): AppRecordDto {
    const name = slug
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      description: `${name} description`,
      logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: 0,
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }

  private _getTopicFromSlug(): DiscussionTopic {
    // This would normally fetch from an API based on the topic slug
    return {
      id: '1',
      title: 'How to integrate with external APIs?',
      author: 'Sarah Chen',
      authorAvatar: 'https://i.pravatar.cc/40?img=1',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      repliesCount: 12,
      viewsCount: 156,
      isPinned: true,
      tags: ['integration', 'api', 'help'],
      content: `I'm trying to integrate this app with our existing API infrastructure but running into authentication issues. The documentation mentions OAuth 2.0 support, but I'm not sure how to properly configure the client credentials.

Has anyone successfully integrated this with a REST API? I'd love to see some examples or get guidance on the best practices for handling authentication tokens.

My current setup is using Node.js with Express, and I'm getting 401 errors when trying to make authenticated requests. Any help would be greatly appreciated!`
    };
  }

  getOpeningPost(): DiscussionPostVM {
    const topic = this._getTopicFromSlug();
    return {
      id: topic.id,
      content: topic.content,
      author: {
        name: topic.author,
        avatar: {
          url: topic.authorAvatar
        }
      },
      publishedTime: topic.createdAt,
      engagement: {
        likes: 0
      }
    };
  }

  getReplies(): DiscussionPostVM[] {
    return [
      {
        id: '2',
        content: `I had the same issue! The key is to make sure you're including the Authorization header with "Bearer " prefix. Here's what worked for me:

\`\`\`javascript
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});
\`\`\``,
        author: {
          name: 'Mike Johnson',
          avatar: {
            url: 'https://i.pravatar.cc/40?img=2'
          }
        },
        publishedTime: new Date(Date.now() - 1000 * 60 * 60),
        engagement: {
          likes: 5
        }
      },
      {
        id: '3',
        content: `Make sure you're also checking the token expiration. I was getting 401s because my tokens were expiring every hour. The API returns a refresh token that you can use to get new access tokens.`,
        author: {
          name: 'Emma Wilson',
          avatar: {
            url: 'https://i.pravatar.cc/40?img=3'
          }
        },
        publishedTime: new Date(Date.now() - 1000 * 60 * 45),
        engagement: {
          likes: 3
        }
      }
    ];
  }
}
