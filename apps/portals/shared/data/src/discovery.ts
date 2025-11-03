import { DiscoveryRecentSearchesDto, DiscoverySearchResultDto, EntityType } from '@domains/discovery';
import { PHOTO_SNAP, QUICK_TASK } from './applications';
import { SAMPLE_ARTICLE, TECH_ARTICLE } from './articles';


export const DISCOVERY_SEARCH_PREVIEW_DATA: DiscoverySearchResultDto = {
  itemsNumber: 6,
  query: {
    search: 'photo snap'
  },
  groups: [
    {
      type: EntityType.Application,
      entries: [
        {
          name: PHOTO_SNAP.name,
          coverImageUrl: PHOTO_SNAP.logo,
          slug: PHOTO_SNAP.slug
        },
        {
          name: QUICK_TASK.name,
          coverImageUrl: QUICK_TASK.logo,
          slug: QUICK_TASK.slug,
        }
      ]
    },
    {
      type: EntityType.Article,
      entries: [
        {
          name: SAMPLE_ARTICLE.title,
          coverImageUrl: SAMPLE_ARTICLE.coverImageUrl,
          slug: SAMPLE_ARTICLE.slug
        },
        {
          name: TECH_ARTICLE.title,
          coverImageUrl: TECH_ARTICLE.coverImageUrl,
          slug: TECH_ARTICLE.slug,
        }
      ]
    },
  ]
};


export const DISCOVERY_RECENT_SEARCHES_DATA: DiscoveryRecentSearchesDto = {
  searches: [
    {
      query: {
        search: 'photo snap'
      }
    },
    {
      query: {
        search: 'quick task'
      }
    }
  ]
}