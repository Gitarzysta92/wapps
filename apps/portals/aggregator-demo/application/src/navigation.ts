export const ROUTE_PARAMS = {
  appSlug: ':appSlug',
  topicSlug: ':topicSlug',
  categorySlug: ':categorySlug',
  tagSlug: ':tagSlug',
  suiteSlug: ':suiteSlug',
  articleSlug: ':articleSlug',
  reviewSlug: ':reviewSlug',
  profileId: ':profileId',
}

export const NAVIGATION = {
  home: {
    path: '',
    label: 'Home',
    icon: '@tui.home',
  },
  explore: {
    path: '',
    label: 'Explore',
    icon: '@tui.compass',
  },
  discover: {
    path: 'discover',
    label: 'Discover',
    icon: '@tui.search',
  },
  learn: {
    path: 'learn',
    label: 'Learn',
    icon: '@tui.book',
  },
  overview: {
    path: 'me/profile',
    label: 'Overview',
    icon: '@tui.user',
  },
  myProfile: {
    path: 'me/profile',
    label: 'My profile',
    icon: '@tui.user',
  },
  myFavorite: {
    path: 'me/favorite',
    label: 'Favorites',
    icon: '@tui.folder-heart',
  },
  myDiscussions: {
    path: 'me/discussions',
    label: 'Discussions',
    icon: '@tui.message-circle',
  },
  performance: {
    path: 'preferences',
    label: 'Preferences',
    icon: '@tui.settings',
  },
  settings: {
    path: 'settings',
    label: 'Settings',
    icon: '@tui.settings',
  },
  notifications: {
    path: 'notifications',
    label: 'Notifications',
    icon: '@tui.bell',
  },
  settingsUser: {
    path: 'settings/user',
    label: 'User settings',
    icon: '@tui.settings',
  },
  settingsProfile: {
    path: 'settings/profile',
    label: 'Profile settings',
    icon: '@tui.settings',
  },
  suites: {
    path: 'suites',
    label: 'Suites',
    icon: '@tui.briefcase-business',
  },
  suite: {
    path: `suites/${ROUTE_PARAMS.suiteSlug}`,
    label: 'Suite',
    icon: '@tui.briefcase-business',
  },
  mySuites: {
    path: `my/suites/${ROUTE_PARAMS.suiteSlug}`,
    label: 'My suites',
    icon: '@tui.book-copy',
  },
  createSuite: {
    path: `suites/create`,
    label: 'Create suite',
    icon: '@tui.briefcase-business',
  },
  favouriteSuites: {
    path: `my/favourites/suites`, 
    label: 'Favourite suites',
    icon: '@tui.folder-heart',
  },
  articles: {
    path: 'articles',
    label: 'Articles',
    icon: '@tui.newspaper',
  },
  article: {
    path: `articles/${ROUTE_PARAMS.articleSlug}`,
    label: 'Article',
    icon: '@tui.newspaper',
  },
  applications: {
    path: 'app',
    label: 'Applications',
    icon: '@tui.layout-grid',
  },
  application: {
    path: `apps/${ROUTE_PARAMS.appSlug}`,
    label: 'Application',
    icon: '@tui.box',
  },
  applicationOverview: {
    path: `apps/${ROUTE_PARAMS.appSlug}/overview`,
    label: 'Overview',
    icon: '@tui.box',
  },
  applicationHealth: {
    path: `apps/${ROUTE_PARAMS.appSlug}/health`,
    label: 'Health',
    icon: '@tui.heart-pulse',
  },
  applicationDevLog: {
    path: `apps/${ROUTE_PARAMS.appSlug}/devlog`,
    label: 'Dev log',
    icon: '@tui.git-commit',
  },
  applicationReviews: {
    path: `apps/${ROUTE_PARAMS.appSlug}/reviews`,
    label: 'Reviews',
    icon: '@tui.star',
  },
  applicationReview: {
    path: `apps/${ROUTE_PARAMS.appSlug}/review/${ROUTE_PARAMS.reviewSlug}`,
    label: 'Reviews',
    icon: '@tui.star',
  },
  applicationTopics: {
    path: `apps/${ROUTE_PARAMS.appSlug}/topics`,
    label: 'Topics',
    icon: '@tui.message-circle',
  },
  applicationTopic: {
    path: `apps/${ROUTE_PARAMS.appSlug}/topics/${ROUTE_PARAMS.topicSlug}`,
    label: 'Topic',
    icon: '@tui.message-circle',
  },
  applicationTimeline: {
    path: `apps/${ROUTE_PARAMS.appSlug}/timeline`,
    label: 'Timeline',
    icon: '@tui.list-ordered',
  },
  mefavouriteApplications: {
    path: `my/favourite/apps`, 
    label: 'Favourite applications',
    icon: '@tui.folder-heart',
  },
  myApplications: {
    path: `my/apps`, 
    label: 'Favourite applications',
    icon: '@tui.folder-heart',
  },
  registerApplication: {
    path: `apps/register`, 
    label: 'Register application',
    icon: '@tui.folder-heart',
  },
  claimApplicationOwnership: {
    path: `apps/ownership/${ROUTE_PARAMS.appSlug}`, 
    label: 'Claim application ownership',
    icon: '@tui.folder-heart',
  },
  categories: {
    path: `categories`,
    label: 'Categories',
    icon: '@tui.folder',
  },
  category: {
    path: `categories/${ROUTE_PARAMS.categorySlug}`,
    label: 'Categories',
    icon: '@tui.folder',
  },
  searchByCategory: {
    path: `categories/${ROUTE_PARAMS.categorySlug}/search/`,
    label: 'Search by category',
    icon: '@tui.folder',
  },
  tags: {
    path: 'tags',
    label: 'Tags',
    icon: '@tui.tag',
  },
  tag: {
    path: `tags/${ROUTE_PARAMS.tagSlug}`,
    label: 'Tag',
    icon: '@tui.tag',
  },
  searchByTag: {
    path: `tags/${ROUTE_PARAMS.tagSlug}/search/`,
    label: 'Search by tag',
    icon: '@tui.tag',
  },
  search: {
    path: `search`,
    label: 'Search',
    icon: '@tui.search',
  },
  userProfile: {
    path: `profiles/${ROUTE_PARAMS.profileId}`,
    label: 'User profile',
    icon: '@tui.user',
  }
}

export const DESKTOP_MAIN_NAVIGATION = [
  NAVIGATION.explore,
  NAVIGATION.discover,
  NAVIGATION.learn,
]

export const MOBILE_MAIN_NAVIGATION = [
  NAVIGATION.explore,
  NAVIGATION.discover,
  NAVIGATION.learn,
]

export const DESKTOP_USER_MAIN_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.overview,
  NAVIGATION.performance,
  NAVIGATION.settings,
]

export const APPLICATION_VIEW_MAIN_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.applicationOverview,
  NAVIGATION.applicationTimeline,
  NAVIGATION.applicationReviews,
  NAVIGATION.applicationDevLog,
  NAVIGATION.applicationHealth,
  NAVIGATION.applicationTopics,
]

export const AUTHENTICATED_USER_MAIN_NAVIGATION = [
  NAVIGATION.myProfile,
  NAVIGATION.myFavorite,
  NAVIGATION.myDiscussions,
]

export const AUTHENTICATED_USER_SECONDARY_NAVIGATION = [
  NAVIGATION.myApplications,
  NAVIGATION.claimApplicationOwnership,
  NAVIGATION.settings,
  NAVIGATION.categories,
  NAVIGATION.tags,
]

export const UNAUTHENTICATED_USER_MAIN_NAVIGATION = [
  NAVIGATION.myFavorite,
]

export const UNAUTHENTICATED_USER_SECONDARY_NAVIGATION = [
  NAVIGATION.settings,
]

export const FOOTER_MAIN_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.applications,
  NAVIGATION.suites,
  NAVIGATION.articles,  
  NAVIGATION.myFavorite,
  NAVIGATION.mySuites,
]

export const FOOTER_SECONDARY_NAVIGATION = [
  NAVIGATION.myApplications,
  NAVIGATION.claimApplicationOwnership,
  NAVIGATION.settings,
  NAVIGATION.categories,
  NAVIGATION.tags,
]

export const FOOTER_TERTIARY_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.applications,
  NAVIGATION.suites,
  NAVIGATION.articles,  
  NAVIGATION.myFavorite,
  NAVIGATION.mySuites,
  NAVIGATION.myApplications,
  NAVIGATION.claimApplicationOwnership,
  NAVIGATION.settings,
]

export const FOOTER_QUATERNARY_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.applications,
  NAVIGATION.suites,
  NAVIGATION.articles,  
  NAVIGATION.myFavorite,
  NAVIGATION.mySuites,
  NAVIGATION.myApplications,
  NAVIGATION.claimApplicationOwnership,
  NAVIGATION.settings,
]