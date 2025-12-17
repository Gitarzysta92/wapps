import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IFeedProviderPort, IFeedPage } from '@portals/shared/features/feed';
import { APPLICATIONS } from '@portals/shared/data';
import { Result } from '@standard';

import { 
  ARTICLES_DATA, 
  DISCUSSION_TOPICS_DATA, 
  SUITES_DATA, 
  REVIEWER_NAMES_DATA, 
  REVIEWER_ROLES_DATA, 
  TESTIMONIALS_DATA, 
  HEALTH_STATUS_MESSAGES_DATA 
} from '@portals/shared/data';
import { ApplicationDevLogFeedItem, ApplicationTeaserFeedItemDto, ApplicationHealthFeedItemDto, ApplicationHealthStatusCode, NoticeType, ApplicationReviewFeedItem, ArticleHighlightFeedItem, DiscussionTopicFeedItem, SuiteTeaserFeedItem, FeedItemDto } from '@domains/feed';
import { AppRecordDto } from '@domains/catalog/record';
import { APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';
import { APPLICATION_HEALTH_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';
import { APPLICATION_REVIEW_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';
import { APPLICATION_TEASER_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';
import { ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';
import { DISCUSSION_TOPIC_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';
import { SUITE_TEASER_FEED_ITEM_SELECTOR } from '@portals/shared/features/feed';

@Injectable()
export class ApplicationTimelineFeedProviderService implements IFeedProviderPort {
  private static idCounter = 0;

  public getFeedPage(page: number, size: number): Observable<Result<IFeedPage, Error>> {
    // Use the static data from @portals/shared/data
    const allFeedItems = this.generateFeedItemsFromData();
    
    // Simulate pagination
    const startIndex = page * size;
    const endIndex = startIndex + size;
    const pageItems = allFeedItems.slice(startIndex, endIndex);
    const hasMore = endIndex < allFeedItems.length;

    return of({
      ok: true,
      value: {
        items: pageItems,
        hasMore,
        nextPage: hasMore ? page + 1 : undefined
      }
    });
  }

  private generateFeedItemsFromData(): FeedItemDto[] {
    const feedItems: FeedItemDto[] = [];
    const isRandom = false

    APPLICATIONS.forEach((app) => {
      feedItems.push(this.createApplicationTeaserFeedItem(app));

      if (isRandom && Math.random() > 0.7) {
        feedItems.push(this.createApplicationHealthFeedItem(app));
      }

      if (isRandom && Math.random() > 0.8) {
        feedItems.push(this.createApplicationReviewFeedItem(app));
      }

      if (isRandom && Math.random() > 0.9) {
        feedItems.push(this.createDiscussionTopicFeedItem(app));
      }
    });

    
    if (Math.random() > 0.5) {
      feedItems.push(this.createArticleHighlightFeedItem());
    }

    if (Math.random() > 0.6) {
      feedItems.push(this.createSuiteTeaserFeedItem());
    }

    return isRandom ? feedItems : feedItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private createDevLogFeedItem(item: ApplicationDevLogFeedItem): ApplicationDevLogFeedItem {
    return {
      id: this.generateUniqueId(`app-dev-log-${item.id}`),
      type: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
      timestamp: item.timestamp,
      title: item.appName || 'Application Update',
      subtitle: item.description || 'New version available',
      appSlug: item.appSlug,
      appName: item.appName,
      version: item.version,
      description: item.description,
      releaseDate: item.releaseDate,
      changes: item.changes
    };
  }

  private createApplicationTeaserFeedItem(app: AppRecordDto): ApplicationTeaserFeedItemDto {
    return {
      id: this.generateUniqueId(`app-teaser-${app.id}`),
      type: APPLICATION_TEASER_FEED_ITEM_SELECTOR,
      timestamp: new Date(app.updateDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time within last week
      title: app.name,
      subtitle: `Discover ${app.name} - a powerful application for your needs`,
      appSlug: app.slug,
      appId: String(app.id),
      appName: app.name,
      description: `Discover ${app.name} - a powerful application for your needs`,
      // category: this.getCategoryName(app.categoryId),
      // tags: this.getTagNames(app.tagIds),
      coverImage: {
        url: app.logo,
        alt: `${app.name} logo`
      },
      aggregatedScore: app.rating,
      reviewsCount: app.reviewNumber,
      // categoryLink: `/category/${app.categoryId}`,
      // reviewsLink: `/reviews/${app.slug}`
    } as any;
  }

  private createApplicationHealthFeedItem(app: AppRecordDto): ApplicationHealthFeedItemDto {
    const healthStatus = this.getRandomHealthStatus();
    const statusMessage = this.getRandomHealthMessage();
    const hasNotice = Math.random() > 0.8;
    
    return {
      id: this.generateUniqueId(`app-health-${app.id}`),
      type: APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Within last 24 hours
      title: `${app.name} Health Status`,
      subtitle: statusMessage,
      appSlug: app.slug,
      appId: String(app.id),
      overallStatus: healthStatus,
      statusMessage: statusMessage,
      statusesHistory: [
        { status: ApplicationHealthStatusCode.Operational, timestamp: Date.now() - 86400000 },
        { status: healthStatus, timestamp: Date.now() }
      ],
      notice: {
        type: hasNotice ? NoticeType.Info : NoticeType.Info,
        title: hasNotice ? 'Service Update' : 'System Status',
        message: hasNotice ? 'All systems are running normally' : statusMessage,
        timestamp: new Date()
      }
    };
  }

  private createApplicationReviewFeedItem(app: AppRecordDto): ApplicationReviewFeedItem {
    const reviewerName = this.getRandomReviewerName();
    const testimonial = this.getRandomTestimonial();
    
    return {
      id: this.generateUniqueId(`app-review-${app.id}`),
      type: APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Within last 30 days
      title: `${reviewerName} reviewed ${app.name}`,
      subtitle: testimonial.substring(0, 100) + (testimonial.length > 100 ? '...' : ''),
      appSlug: app.slug,
      appId: String(app.id),
      rating: app.rating + (Math.random() - 0.5) * 0.5, // Slight variation
      reviewerName: reviewerName,
      reviewerRole: this.getRandomReviewerRole(),
      reviewerAvatar: '',
      testimonial: testimonial,
      appName: app.name,
      reviewDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      helpfulCount: Math.floor(Math.random() * 150) + 10
    };
  }

  private createArticleHighlightFeedItem(): ArticleHighlightFeedItem {
    const article = ARTICLES_DATA[Math.floor(Math.random() * ARTICLES_DATA.length)];
    
    return {
      id: this.generateUniqueId('article-highlight'),
      type: ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last week
      title: article.title,
      subtitle: article.excerpt,
      excerpt: article.excerpt,
      author: article.author,
      category: article.category,
      coverImage: {
        url: 'https://picsum.photos/seed/article/400/200',
        alt: article.title
      }
    };
  }

  private createDiscussionTopicFeedItem(app: AppRecordDto): DiscussionTopicFeedItem {
    const topic = DISCUSSION_TOPICS_DATA[Math.floor(Math.random() * DISCUSSION_TOPICS_DATA.length)];
    const topicSlug = topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    return {
      id: this.generateUniqueId(`discussion-topic-${app.id}`),
      type: DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
      timestamp: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000), // Within last 3 days
      title: `Discussion: ${topic}`,
      subtitle: `Join the conversation about ${topic.toLowerCase()}`,
      appSlug: app.slug,
      topicSlug: topicSlug,
      discussionData: {
        topic: topic,
        messages: [
          {
            id: 1,
            author: 'John Developer',
            content: 'Great question! I think the key is to...',
            timestamp: new Date()
          },
          {
            id: 2,
            author: 'Sarah Engineer',
            content: 'I agree with John, and would add that...',
            timestamp: new Date()
          }
        ]
      },
      participantsCount: Math.floor(Math.random() * 50) + 5,
      viewsCount: Math.floor(Math.random() * 200) + 20
    };
  }

  private createSuiteTeaserFeedItem(): SuiteTeaserFeedItem {
    const suite = SUITES_DATA[Math.floor(Math.random() * SUITES_DATA.length)];
    
    return {
      id: this.generateUniqueId('suite-teaser'),
      type: SUITE_TEASER_FEED_ITEM_SELECTOR,
      timestamp: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Within last 2 weeks
      title: suite.title,
      subtitle: suite.description,
      suiteTitle: suite.title,
      suiteDescription: suite.description,
      apps: suite.apps,
      category: suite.category
    };
  }

  private getCategoryName(categoryId: number): string {
    const categories: Record<number, string> = {
      71: 'Photo Editing',
      19: 'Project Management',
      54: 'VPN Client',
      83: 'Budgeting Apps',
      153: 'Meditation Apps',
      148: 'Activity Tracking',
      178: 'Ecommerce Platforms'
    };
    return categories[categoryId] || 'General';
  }

  private getTagNames(tagIds: number[]): string[] {
    const tags: Record<number, string> = {
      71: 'Photo Editing',
      11: 'Web Development',
      12: 'Mobile Development',
      25: 'Productivity',
      8: 'Security',
      9: 'Networking',
      21: 'Finance',
      23: 'Health',
      18: 'Ecommerce'
    };
    return tagIds.map(id => tags[id] || `Tag ${id}`).slice(0, 3); // Max 3 tags
  }

  private getRandomHealthStatus(): ApplicationHealthStatusCode {
    const statuses: ApplicationHealthStatusCode[] = [
      ApplicationHealthStatusCode.Operational, 
      ApplicationHealthStatusCode.Degraded, 
      ApplicationHealthStatusCode.Outage
    ];
    const weights = [0.8, 0.15, 0.05]; // 80% operational, 15% degraded, 5% outage
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return statuses[i];
      }
    }
    return ApplicationHealthStatusCode.Operational;
  }

  private getRandomHealthMessage(): string {
    const status = this.getRandomHealthStatus();
    const statusMessages = HEALTH_STATUS_MESSAGES_DATA[status];
    return statusMessages[Math.floor(Math.random() * statusMessages.length)];
  }

  private getRandomReviewerName(): string {
    return REVIEWER_NAMES_DATA[Math.floor(Math.random() * REVIEWER_NAMES_DATA.length)];
  }

  private getRandomReviewerRole(): string {
    return REVIEWER_ROLES_DATA[Math.floor(Math.random() * REVIEWER_ROLES_DATA.length)];
  }

  private getRandomTestimonial(): string {
    return TESTIMONIALS_DATA[Math.floor(Math.random() * TESTIMONIALS_DATA.length)];
  }

  private generateUniqueId(prefix: string): string {
    return `${prefix}-${uuidv4()}-${Date.now()}`;
  }
}

function uuidv4(): string {
  return crypto.randomUUID();
}

