import { FeedItemDto } from '@domains/feed';
import { IFeedItem, FeedItemType, FeedItemPriority } from '../models';

/**
 * Maps domain FeedItemDto to presentation IFeedItem
 */
export class FeedItemMapper {
  static toPresentationModel(dto: FeedItemDto): IFeedItem {
    return {
      id: dto.id,
      type: this.mapType(dto.type),
      timestamp: dto.timestamp,
      priority: this.mapPriority(dto.params?.['priority'] as string),
      metadata: this.mapMetadata(dto.params)
    };
  }

  static toDomainModel(item: IFeedItem): FeedItemDto {
    return {
      id: item.id,
      type: this.mapTypeToDomain(item.type),
      timestamp: item.timestamp,
      params: {
        priority: this.mapPriorityToDomain(item.priority),
        ...item.metadata
      }
    };
  }

  private static mapType(domainType: string): FeedItemType {
    // Map domain types to presentation types
    switch (domainType) {
      case 'article-highlight':
        return FeedItemType.ARTICLE_HIGHLIGHT;
      case 'application-health':
        return FeedItemType.APPLICATION_HEALTH;
      case 'forum-reply':
        return FeedItemType.FORUM_REPLY;
      case 'changelog-update':
        return FeedItemType.CHANGELOG_UPDATE;
      case 'application-ad':
        return FeedItemType.APPLICATION_AD;
      case 'suite-update':
        return FeedItemType.SUITE_UPDATE;
      case 'user-post':
        return FeedItemType.USER_POST;
      case 'system-notification':
        return FeedItemType.SYSTEM_NOTIFICATION;
      default:
        return FeedItemType.SYSTEM_NOTIFICATION;
    }
  }

  private static mapTypeToDomain(presentationType: FeedItemType): string {
    // Map presentation types back to domain types
    switch (presentationType) {
      case FeedItemType.ARTICLE_HIGHLIGHT:
        return 'article-highlight';
      case FeedItemType.APPLICATION_HEALTH:
        return 'application-health';
      case FeedItemType.FORUM_REPLY:
        return 'forum-reply';
      case FeedItemType.CHANGELOG_UPDATE:
        return 'changelog-update';
      case FeedItemType.APPLICATION_AD:
        return 'application-ad';
      case FeedItemType.SUITE_UPDATE:
        return 'suite-update';
      case FeedItemType.USER_POST:
        return 'user-post';
      case FeedItemType.SYSTEM_NOTIFICATION:
        return 'system-notification';
      default:
        return 'system-notification';
    }
  }

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
