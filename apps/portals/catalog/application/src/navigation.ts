export const ROUTE_PARAMS = {
  appSlug: ':appSlug',
};

export const NAVIGATION = {
  home: {
    path: '',
    label: 'Home',
    icon: '@tui.home',
  },
  catalog: {
    path: 'catalog',
    label: 'App Catalog',
    icon: '@tui.layout-grid',
  },
  appDetails: {
    path: `apps/${ROUTE_PARAMS.appSlug}`,
    label: 'App Details',
    icon: '@tui.box',
  },
};

export const MAIN_NAVIGATION = [
  NAVIGATION.home,
  NAVIGATION.catalog,
];
