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
  feed: {
    id: 12,
    path: 'feed',
    label: 'Feed',
    icon: '@tui.rss',
    slots: [
      { id: Menu.Main, order: 4 },
      { id: Menu.FooterFirst, order: 7 }
    ]
  },
}
