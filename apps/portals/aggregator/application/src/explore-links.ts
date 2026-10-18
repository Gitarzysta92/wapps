import type { ExploreLinkTarget } from '@portals/shared/features/feed';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { NAVIGATION } from './navigation';

export function exploreLink(target: ExploreLinkTarget): {
  path: string | string[];
  query?: Record<string, string>;
} {
  switch (target.kind) {
    case 'application-reviews':
      return {
        path: buildRoutePath(
          NAVIGATION.applicationReviews.path,
          { appSlug: target.applicationSlug },
          { absolute: true }
        ),
      };
    case 'application':
      return {
        path: buildRoutePath(
          NAVIGATION.applicationOverview.path,
          {
            appSlug: target.slug,
          },
          { absolute: true }
        ),
      };
    case 'suite':
      return {
        path: buildRoutePath(
          NAVIGATION.suite.path,
          { suiteSlug: target.id },
          { absolute: true }
        ),
      };
    case 'article':
      return {
        path: buildRoutePath(
          NAVIGATION.article.path,
          {
            articleSlug: target.slug,
          },
          { absolute: true }
        ),
      };
    case 'discussion':
      return {
        path: buildRoutePath(
          NAVIGATION.applicationDiscussion.path,
          {
            appSlug: target.applicationSlug,
            discussionSlug: target.id,
          },
          { absolute: true }
        ),
      };
    case 'review':
      return {
        path: buildRoutePath(
          NAVIGATION.applicationReview.path,
          {
            appSlug: target.applicationSlug,
            reviewSlug: target.id,
          },
          { absolute: true }
        ),
      };
    case 'release':
      return {
        path: [
          buildRoutePath(
            NAVIGATION.applicationDevLog.path,
            { appSlug: target.applicationSlug },
            { absolute: true }
          ),
          target.version,
        ],
      };
  }
}
