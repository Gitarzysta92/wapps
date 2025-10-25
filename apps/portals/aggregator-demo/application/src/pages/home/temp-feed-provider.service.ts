import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IFeedProviderPort, IFeedPage } from '@portals/shared/features/feed';
import { IFeedItem } from '@portals/shared/features/feed';
import { APPLICATIONS } from '@portals/shared/data';
import { feed } from '@portals/shared/data';

@Injectable()
export class TempFeedProviderService implements IFeedProviderPort {

  public getFeedPage(page: number, size: number): Observable<IFeedPage> {
    // Use the static data from @portals/shared/data
    const allFeedItems = this.generateFeedItemsFromData();
    
    // Simulate pagination
    const startIndex = page * size;
    const endIndex = startIndex + size;
    const pageItems = allFeedItems.slice(startIndex, endIndex);
    const hasMore = endIndex < allFeedItems.length;

    return of({
      items: pageItems,
      hasMore,
      nextPage: hasMore ? page + 1 : undefined
    });
  }

  private generateFeedItemsFromData(): IFeedItem[] {
    const feedItems: IFeedItem[] = [];

    // Add items from the static feed data
    feed.forEach((item, index) => {
      feedItems.push({
        id: item.id,
        type: item.type,
        timestamp: item.timestamp,
        // Data should be directly on the item, not under params
        appSlug: item.appSlug,
        appName: item.appName,
        version: item.version,
        description: item.description,
        releaseDate: item.releaseDate,
        changes: item.changes
      });
    });

    // Generate additional feed items based on applications data
    APPLICATIONS.forEach((app, index) => {
      // Create application teaser items
      feedItems.push({
        id: `app-teaser-${app.id}`,
        type: 'application-teaser',
        timestamp: new Date(app.updateDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time within last week
        // Data should be directly on the item, not under params
        applicationSlug: app.slug,
        applicationId: app.id,
        applicationName: app.name,
        description: `Discover ${app.name} - a powerful application for your needs`,
        category: this.getCategoryName(app.categoryId),
        tags: this.getTagNames(app.tagIds),
        coverImage: {
          url: app.logo,
          alt: `${app.name} logo`
        },
        aggregatedScore: app.rating,
        reviewsCount: app.reviewNumber,
        categoryLink: `/category/${app.categoryId}`,
        reviewsLink: `/reviews/${app.slug}`
      });

      // Create application health items (randomly)
      if (Math.random() > 0.7) {
        feedItems.push({
          id: `app-health-${app.id}`,
          type: 'application-health',
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Within last 24 hours
          // Data should be directly on the item, not under params
          applicationSlug: app.slug,
          applicationId: app.id,
          overallStatus: this.getRandomHealthStatus(),
          statusMessage: this.getRandomHealthMessage(),
          services: [{
            name: app.name,
            status: this.getRandomHealthStatus(),
            uptime: Math.floor(Math.random() * 100),
            hasInfo: Math.random() > 0.5
          }],
          notices: Math.random() > 0.8 ? [{
            type: 'info' as const,
            title: 'Service Update',
            message: 'All systems are running normally',
            timestamp: new Date()
          }] : undefined
        });
      }

      // Create application review items (randomly)
      if (Math.random() > 0.8) {
        feedItems.push({
          id: `app-review-${app.id}`,
          type: 'application-review',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Within last 30 days
          // Data should be directly on the item, not under params
          applicationSlug: app.slug,
          applicationId: app.id,
          rating: app.rating + (Math.random() - 0.5) * 0.5, // Slight variation
          reviewerName: this.getRandomReviewerName(),
          reviewerRole: this.getRandomReviewerRole(),
          reviewerAvatar: '',
          testimonial: this.getRandomTestimonial(),
          applicationName: app.name,
          reviewDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          helpfulCount: Math.floor(Math.random() * 150) + 10
        });
      }
    });

    // Sort by timestamp (newest first)
    return feedItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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

  private getRandomHealthStatus(): 'operational' | 'degraded' | 'outage' {
    const statuses: ('operational' | 'degraded' | 'outage')[] = ['operational', 'degraded', 'outage'];
    const weights = [0.8, 0.15, 0.05]; // 80% operational, 15% degraded, 5% outage
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return statuses[i];
      }
    }
    return 'operational';
  }

  private getRandomHealthMessage(): string {
    const messages = {
      operational: [
        'All systems operational with excellent performance',
        'Service running smoothly with optimal response times',
        'No issues detected, all metrics within normal range',
        'System health is excellent, uptime at 99.9%'
      ],
      degraded: [
        'High memory usage detected, monitoring closely',
        'Response times slightly elevated, investigating',
        'Minor performance degradation observed',
        'Increased error rate detected, monitoring situation'
      ],
      outage: [
        'Service experiencing issues, investigating',
        'Critical error detected, immediate attention required',
        'Service unavailable, emergency response activated',
        'System failure detected, recovery in progress'
      ]
    };
    
    const status = this.getRandomHealthStatus();
    const statusMessages = messages[status];
    return statusMessages[Math.floor(Math.random() * statusMessages.length)];
  }

  private getRandomReviewerName(): string {
    const names = [
      'John Developer',
      'Sarah Engineer',
      'Mike Tester',
      'Emily Architect',
      'David Admin',
      'Lisa Manager',
      'Tom Designer',
      'Anna Analyst'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  private getRandomReviewerRole(): string {
    const roles = [
      'Developer',
      'Software Engineer',
      'QA Tester',
      'Solutions Architect',
      'System Administrator',
      'Project Manager',
      'UI/UX Designer',
      'Data Analyst'
    ];
    return roles[Math.floor(Math.random() * roles.length)];
  }

  private getRandomTestimonial(): string {
    const testimonials = [
      'This application has transformed our workflow. Highly recommended for teams looking to improve productivity.',
      'Excellent tool with intuitive interface. The features are exactly what we needed for our project.',
      'Outstanding performance and reliability. Our team has been using it for months without any issues.',
      'Great application with solid documentation. Easy to integrate into our existing infrastructure.',
      'Impressed with the support and regular updates. The development team really cares about user feedback.',
      'Best solution in its category. The features are comprehensive and well-thought-out.',
      'Game-changer for our development process. Saved us countless hours of manual work.',
      'Reliable and efficient. The application delivers exactly what it promises without bloat.'
    ];
    return testimonials[Math.floor(Math.random() * testimonials.length)];
  }
}
