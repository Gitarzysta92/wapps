export enum Menu {
  Main = 'main',
  UserPanelPrimary = 'user-panel-primary',
  UserPanelSecondary = 'user-panel-secondary',
  GuestPanelPrimary = 'guest-panel-primary',
  GuestPanelSecondary = 'guest-panel-secondary',
  FooterFirst = 'footer-first',
  FooterSecond = 'footer-second',
  FooterThird = 'footer-third',
  FooterFourth = 'footer-fourth'
}

export const ROUTE_PARAMS = {
  appSlug: ':appSlug',
  topicSlug: ':topicSlug',
}

export const NAVIGATION = {
  home: {
    id: 1,
    path: '',
    label: 'Home',
    icon: '@tui.home',
    slots: [
      { id: Menu.Main, order: 1 }
    ]
  },
  applications: {
    id: 2,
    path: 'applications',
    label: 'Applications',
    icon: '@tui.layout-grid',
    slots: [
      { id: Menu.Main, order: 1 },
      { id: Menu.FooterFirst, order: 1 }
    ]
  },
  suites: {
    id: 3,
    path: 'suites',
    label: 'Suites',
    icon: '@tui.briefcase-business',
    slots: [
      { id: Menu.Main, order: 2 },
    ]
  },
  articles: {
    id: 4,
    path: 'articles',
    label: 'Articles',
    icon: '@tui.newspaper',
    slots: [
      { id: Menu.Main, order: 3 },
    ]
  },
  favourites: {
    id: 5,
    path: 'favourites',
    label: 'Favourites',
    icon: '@tui.folder-heart',
    slots: [
      { id: Menu.UserPanelPrimary, order: 2 },
      { id: Menu.FooterFirst, order: 2 }
    ]
  },
  mySuites: {
    id: 6,
    path: 'my-suites',
    label: 'My suites',
    icon: '@tui.book-copy',
    slots: [
      { id: Menu.UserPanelPrimary, order: 3 },
      { id: Menu.FooterFirst, order: 3 }
    ]
  },
  myApps: {
    id: 7,
    path: 'my-apps',
    label: 'My apps',
    icon: '@tui.app-window',
    slots: [
      { id: Menu.UserPanelPrimary, order: 4 },
      { id: Menu.FooterFirst, order: 4 }
    ]
  },
  ownership: {
    id: 8,
    path: 'ownership',
    label: 'Ownership',
    icon: '@tui.link',
    slots: [
      { id: Menu.UserPanelPrimary, order: 5 },
      { id: Menu.FooterFirst, order: 5 }
    ]
  },
  settings: {
    id: 9,
    path: 'settings',
    label: 'Settings',
    icon: '@tui.settings',
    slots: [
      { id: Menu.UserPanelSecondary, order: 6 },
      { id: Menu.FooterFirst, order: 6 }
    ]
  },
  categories: {
    id: 10,
    path: 'category',
    label: 'Categories',
    icon: '@tui.folder',
    slots: [
    ]
  },
  tags: {
    id: 11,
    path: 'tags',
    label: 'Tags',
    icon: '@tui.tag',
    slots: [
    ]
  },
  applicationOverview: {
    id: 13,
    path: `app/${ROUTE_PARAMS.appSlug}/overview`,
    label: 'Overview',
    icon: '@tui.box',
    slots: []
  },
  applicationHealth: {
    id: 14,
    path: `app/${ROUTE_PARAMS.appSlug}/health`,
    label: 'Health',
    icon: '@tui.heart-pulse',
    slots: []
  },
  applicationDevLog: {
    id: 15,
    path: `app/${ROUTE_PARAMS.appSlug}/devlog`,
    label: 'Dev log',
    icon: '@tui.git-commit',
    slots: []
  },
  applicationReviews: {
    id: 16,
    path: `app/${ROUTE_PARAMS.appSlug}/reviews`,
    label: 'Reviews',
    icon: '@tui.star',
    slots: []
  },
  applicationTopics: {
    id: 17,
    path: `app/${ROUTE_PARAMS.appSlug}/topics`,
    label: 'Topics',
    icon: '@tui.message-circle',
    slots: []
  },
  applicationTopic: {
    id: 18,
    path: `app/${ROUTE_PARAMS.appSlug}/topics/${ROUTE_PARAMS.topicSlug}`,
    label: 'Topic',
    icon: '@tui.message-circle',
    slots: []
  },
  applicationTimeline: {
    id: 18,
    path: `app/${ROUTE_PARAMS.appSlug}/timeline`,
    label: 'Timeline',
    icon: '@tui.list-ordered',
    slots: []
  }
}

export const HOME_VIEW_MAIN_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.applications,
  NAVIGATION.suites,
  NAVIGATION.articles,
]


export const APPLICATION_VIEW_MAIN_NAVIGATION = [
  NAVIGATION.applicationOverview,
  NAVIGATION.applicationTimeline,
  NAVIGATION.applicationReviews,
  NAVIGATION.applicationHealth,
  NAVIGATION.applicationTopics,
  NAVIGATION.home,
]