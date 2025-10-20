import { FeedItemPriority } from '../models/feed-item.interface';

/**
 * Maps domain FeedItemDto to presentation IFeedItem
 */
export class FeedItemMapper {


  private static mapPriority(domainPriority?: string): FeedItemPriority {
    switch (domainPriority) {
      case 'low':
        return FeedItemPriority.LOW;
      case 'medium':
        return FeedItemPriority.MEDIUM;
      case 'high':
        return FeedItemPriority.HIGH;
      case 'urgent':
        return FeedItemPriority.URGENT;
      default:
        return FeedItemPriority.MEDIUM;
    }
  }

  private static mapPriorityToDomain(presentationPriority: FeedItemPriority): string {
    switch (presentationPriority) {
      case FeedItemPriority.LOW:
        return 'low';
      case FeedItemPriority.MEDIUM:
        return 'medium';
      case FeedItemPriority.HIGH:
        return 'high';
      case FeedItemPriority.URGENT:
        return 'urgent';
      default:
        return 'medium';
    }
  }

  private static mapMetadata(params: { [key: string]: unknown }): Record<string, any> {
    // Extract metadata from params, excluding system fields
    const { priority, ...metadata } = params;
    return metadata;
  }
}
