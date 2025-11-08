import { DiscoveryRecentSearchesDto, DiscoverySearchResultDto, DiscoverySearchResultType } from '@domains/discovery';
import { APPLICATIONS } from './applications';
import { ARTICLES } from './articles';
import { CATEGORY_DICTIONARY } from './categories';
import { TAG_DICTIONARY } from './tags';

const [PHOTO_SNAP, QUICK_TASK, SPEEDY_VPN, BUDGET_BUDDY, MINDFUL, FIT_TRACK, SHOP_EASE] = APPLICATIONS;
const [SAMPLE_ARTICLE, TECH_ARTICLE, DESIGN_ARTICLE] = ARTICLES;



export const DISCOVERY_SEARCH_PREVIEW_DATA: DiscoverySearchResultDto = {
  itemsNumber: 7,
  query: {
    search: 'photo snap'
  },
  groups: [
    {
      type: DiscoverySearchResultType.Suite,
      entries: [
        {
          type: DiscoverySearchResultType.Suite,
          name: 'Creative Tools Suite',
          slug: 'creative-tools-suite',
          coverImageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800',
          numberOfApps: 6,
          commentsNumber: 78,
          authorName: 'Creative Studio',
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        }
      ]
    },
    {
      type: DiscoverySearchResultType.Application,
      entries: [
        {
          type: DiscoverySearchResultType.Application,
          name: PHOTO_SNAP.name,
          coverImageUrl: PHOTO_SNAP.logo,
          slug: PHOTO_SNAP.slug,
          rating: PHOTO_SNAP.rating,
          commentsNumber: PHOTO_SNAP.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.photoEditing.slug,
            name: CATEGORY_DICTIONARY.photoEditing.name
          },
          tags: [
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        },
        {
          type: DiscoverySearchResultType.Application,
          name: QUICK_TASK.name,
          coverImageUrl: QUICK_TASK.logo,
          slug: QUICK_TASK.slug,
          rating: QUICK_TASK.rating,
          commentsNumber: QUICK_TASK.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.projectManagementSoftware.slug,
            name: CATEGORY_DICTIONARY.projectManagementSoftware.name
          },
          tags: [
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        }
      ]
    },
    {
      type: DiscoverySearchResultType.Article,
      entries: [  
        {
          type: DiscoverySearchResultType.Article,
          name: SAMPLE_ARTICLE.title,
          title: SAMPLE_ARTICLE.title,
          coverImageUrl: SAMPLE_ARTICLE.coverImageUrl,
          slug: SAMPLE_ARTICLE.slug,
          commentsNumber: 42,
          authorName: SAMPLE_ARTICLE.author,
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        },
        {
          type: DiscoverySearchResultType.Article,
          name: TECH_ARTICLE.title,
          title: TECH_ARTICLE.title,
          coverImageUrl: TECH_ARTICLE.coverImageUrl,
          slug: TECH_ARTICLE.slug,
          commentsNumber: 87,
          authorName: TECH_ARTICLE.author,
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
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


export const DISCOVERY_SEARCH_RESULTS_DATA: DiscoverySearchResultDto = {
  query: {
    search: 'productivity apps'
  },
  itemsNumber: 18,
  groups: [
    {
      type: DiscoverySearchResultType.Suite,
      entries: [
        {
          type: DiscoverySearchResultType.Suite,
          name: 'Complete Productivity Suite',
          slug: 'complete-productivity-suite',
          coverImageUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800',
          numberOfApps: 8,
          commentsNumber: 156,
          authorName: 'Productivity Team',
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        },
        {
          type: DiscoverySearchResultType.Suite,
          name: 'Health & Wellness Collection',
          slug: 'health-wellness-collection',
          coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
          numberOfApps: 5,
          commentsNumber: 92,
          authorName: 'Wellness Group',
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        },
        {
          type: DiscoverySearchResultType.Suite,
          name: 'Business Essentials Pack',
          slug: 'business-essentials-pack',
          coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
          numberOfApps: 12,
          commentsNumber: 234,
          authorName: 'Business Solutions Inc',
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        }
      ]
    },
    {
      type: DiscoverySearchResultType.Application,
      entries: [
        { 
          type: DiscoverySearchResultType.Application,
          name: PHOTO_SNAP.name,
          coverImageUrl: PHOTO_SNAP.logo,
          slug: PHOTO_SNAP.slug,
          rating: PHOTO_SNAP.rating,
          commentsNumber: PHOTO_SNAP.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.photoEditing.slug,
            name: CATEGORY_DICTIONARY.photoEditing.name
          },
          tags: [
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        },
        { 
          type: DiscoverySearchResultType.Application,
          name: QUICK_TASK.name,
          coverImageUrl: QUICK_TASK.logo,
          slug: QUICK_TASK.slug,
          rating: QUICK_TASK.rating,
          commentsNumber: QUICK_TASK.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.projectManagementSoftware.slug,
            name: CATEGORY_DICTIONARY.projectManagementSoftware.name
          },
          tags: [
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name },
            { slug: TAG_DICTIONARY.mobileDevelopment.slug, name: TAG_DICTIONARY.mobileDevelopment.name }
          ]
        },
        { 
          type: DiscoverySearchResultType.Application,
          name: BUDGET_BUDDY.name,
          coverImageUrl: BUDGET_BUDDY.logo,
          slug: BUDGET_BUDDY.slug,
          rating: BUDGET_BUDDY.rating,
          commentsNumber: BUDGET_BUDDY.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.budgetingApps.slug,
            name: CATEGORY_DICTIONARY.budgetingApps.name
          },
          tags: [
            { slug: TAG_DICTIONARY.finance.slug, name: TAG_DICTIONARY.finance.name },
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.mobile.slug, name: TAG_DICTIONARY.mobile.name }
          ]
        },
        { 
          type: DiscoverySearchResultType.Application,
          name: MINDFUL.name,
          coverImageUrl: MINDFUL.logo,
          slug: MINDFUL.slug,
          rating: MINDFUL.rating,
          commentsNumber: MINDFUL.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.meditationApps.slug,
            name: CATEGORY_DICTIONARY.meditationApps.name
          },
          tags: [
            { slug: TAG_DICTIONARY.health.slug, name: TAG_DICTIONARY.health.name },
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.mobile.slug, name: TAG_DICTIONARY.mobile.name }
          ]
        },
        { 
          type: DiscoverySearchResultType.Application,
          name: FIT_TRACK.name,
          coverImageUrl: FIT_TRACK.logo,
          slug: FIT_TRACK.slug,
          rating: FIT_TRACK.rating,
          commentsNumber: FIT_TRACK.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.activityTracking.slug,
            name: CATEGORY_DICTIONARY.activityTracking.name
          },
          tags: [
            { slug: TAG_DICTIONARY.health.slug, name: TAG_DICTIONARY.health.name },
            { slug: TAG_DICTIONARY.mobile.slug, name: TAG_DICTIONARY.mobile.name },
            { slug: TAG_DICTIONARY.web.slug, name: TAG_DICTIONARY.web.name }
          ]
        },
        { 
          type: DiscoverySearchResultType.Application,
          name: SPEEDY_VPN.name,
          coverImageUrl: SPEEDY_VPN.logo,
          slug: SPEEDY_VPN.slug,
          rating: SPEEDY_VPN.rating,
          commentsNumber: SPEEDY_VPN.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.vpnClient.slug,
            name: CATEGORY_DICTIONARY.vpnClient.name
          },
          tags: [
            { slug: TAG_DICTIONARY.security.slug, name: TAG_DICTIONARY.security.name },
            { slug: TAG_DICTIONARY.networking.slug, name: TAG_DICTIONARY.networking.name },
            { slug: TAG_DICTIONARY.web.slug, name: TAG_DICTIONARY.web.name }
          ]
        },
        { 
          type: DiscoverySearchResultType.Application,
          name: SHOP_EASE.name,
          coverImageUrl: SHOP_EASE.logo,
          slug: SHOP_EASE.slug,
          rating: SHOP_EASE.rating,
          commentsNumber: SHOP_EASE.reviewNumber,
          category: {
            slug: CATEGORY_DICTIONARY.ecommercePlatforms.slug,
            name: CATEGORY_DICTIONARY.ecommercePlatforms.name
          },
          tags: [
            { slug: TAG_DICTIONARY.ecommerce.slug, name: TAG_DICTIONARY.ecommerce.name },
            { slug: TAG_DICTIONARY.finance.slug, name: TAG_DICTIONARY.finance.name },
            { slug: TAG_DICTIONARY.web.slug, name: TAG_DICTIONARY.web.name }
          ]
        }
      ]
    },
    {
      type: DiscoverySearchResultType.Article,
      entries: [
        {
          type: DiscoverySearchResultType.Article,
          name: SAMPLE_ARTICLE.title,
          title: SAMPLE_ARTICLE.title,
          coverImageUrl: SAMPLE_ARTICLE.coverImageUrl,
          slug: SAMPLE_ARTICLE.slug,
          commentsNumber: 42,
          authorName: SAMPLE_ARTICLE.author,
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.productivity.slug, name: TAG_DICTIONARY.productivity.name },
            { slug: TAG_DICTIONARY.webDevelopment.slug, name: TAG_DICTIONARY.webDevelopment.name }
          ]
        },
        {
          type: DiscoverySearchResultType.Article,
          name: TECH_ARTICLE.title,
          title: TECH_ARTICLE.title,
          coverImageUrl: TECH_ARTICLE.coverImageUrl,
          slug: TECH_ARTICLE.slug,
          commentsNumber: 87,
          authorName: TECH_ARTICLE.author,
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.ai.slug, name: TAG_DICTIONARY.ai.name },
            { slug: TAG_DICTIONARY.cloud.slug, name: TAG_DICTIONARY.cloud.name }
          ]
        },
        {
          type: DiscoverySearchResultType.Article,
          name: DESIGN_ARTICLE.title,
          title: DESIGN_ARTICLE.title,
          coverImageUrl: DESIGN_ARTICLE.coverImageUrl,
          slug: DESIGN_ARTICLE.slug,
          commentsNumber: 53,
          authorName: DESIGN_ARTICLE.author,
          authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
          tags: [
            { slug: TAG_DICTIONARY.web.slug, name: TAG_DICTIONARY.web.name },
            { slug: TAG_DICTIONARY.mobile.slug, name: TAG_DICTIONARY.mobile.name }
          ]
        }
      ]
    },
  ]
}