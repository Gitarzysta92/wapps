export const ROUTE_PARAMS = {
  discussionSlug: ':discussionSlug',
};

export const NAVIGATION = {
  home: {
    path: '',
    label: 'Home',
    icon: '@tui.home',
  },
  discussions: {
    path: 'discussions',
    label: 'Discussions',
    icon: '@tui.message-circle',
  },
  login: {
    path: 'login',
    label: 'Login',
    icon: '@tui.log-in',
  },
  discussion: {
    path: `discussions/${ROUTE_PARAMS.discussionSlug}`,
    label: 'Discussion',
    icon: '@tui.message-circle',
  },
};

export const MAIN_NAVIGATION = [NAVIGATION.home, NAVIGATION.discussions];

