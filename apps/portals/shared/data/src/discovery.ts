import { DiscoverySearchResultDto, EntityType } from '@domains/discovery';
import { PHOTO_SNAP, QUICK_TASK } from './applications';

export const DISCOVERY_MOCK_SEARCH_PREVIEW_DATA: DiscoverySearchResultDto = {
  itemsNumber: 6,
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
  ]
};