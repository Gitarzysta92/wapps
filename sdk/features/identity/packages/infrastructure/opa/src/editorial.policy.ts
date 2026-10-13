import type { AuthorizationPolicyDefinition } from './types';

const apps = [
  'editorial.app.create',
  'editorial.app.update',
  'editorial.app.delete',
];
const taxonomy = ['category', 'tag'].flatMap((kind) =>
  ['create', 'update', 'delete'].map(
    (operation) => `editorial.${kind}.${operation}`
  )
);
const suites = ['read', 'create', 'update', 'delete', 'submit', 'withdraw'].map(
  (operation) => `editorial.suite.${operation}`
);
const articles = [
  'read',
  'create',
  'update',
  'delete',
  'submit',
  'withdraw',
].map((operation) => `editorial.article.${operation}`);
const releases = [
  'read',
  'create',
  'open',
  'update',
  'rebase',
  'delete',
  'submit',
  'withdraw',
].map((operation) => `editorial.release.${operation}`);
const applicationDrafts = ['read', 'create', 'update', 'delete'].map(
  (operation) => `editorial.application-draft.${operation}`
);
const applicationPublication = ['read', 'submit', 'withdraw'].map(
  (operation) => `editorial.application.${operation}`
);
const ownership = ['read', 'create', 'verify', 'cancel', 'release'].map(
  (operation) => `editorial.ownership.${operation}`
);
const applicationImages = ['read', 'create', 'upload', 'cancel'].map(
  (operation) => `editorial.application-image.${operation}`
);
const articleCovers = ['read', 'create', 'upload', 'cancel'].map(
  (operation) => `editorial.article-cover.${operation}`
);
const ownershipReview = [
  'editorial.ownership.review',
  'editorial.ownership.revoke',
];

/** Direct catalog publication requires an explicit publisher role; submissions use a separate workflow. */
export const editorialPolicy: AuthorizationPolicyDefinition = {
  packageName: 'wapps.editorial.authz',
  supportedActions: [
    'editorial.health.configure',
    'editorial.health.probe',
    'editorial.explore.read',
    'editorial.favorite-updates.read',
    'editorial.account-export.read',
    'editorial.account-erasure.request',
    ...apps,
    ...taxonomy,
    ...suites,
    ...releases,
    ...articles,
    ...applicationDrafts,
    ...applicationPublication,
    ...applicationImages,
    ...articleCovers,
    ...ownership,
    ...ownershipReview,
    'editorial.application.review',
    'editorial.suite.review',
    'editorial.release.review',
    'editorial.article.review',
    'editorial.profile.suites.read',
    'editorial.profile.articles.read',
    'editorial.profile.activity.read',
    'editorial.profile.totals.read',
  ],
  selfActions: [
    ...suites,
    ...releases,
    ...articles,
    ...applicationDrafts,
    ...applicationPublication,
    ...applicationImages,
    ...articleCovers,
    ...ownership,
  ],
  rolePermissions: {
    'editorial:health-manager': ['editorial.health.configure'],
    'health:monitor': ['editorial.health.probe'],
    'explore:reader': ['editorial.explore.read'],
    'account-erasure:writer': ['editorial.account-erasure.request'],
    'notification:worker': ['editorial.favorite-updates.read'],
    'account-export:reader': ['editorial.account-export.read'],
    'editorial:profile-reader': [
      'editorial.profile.suites.read',
      'editorial.profile.articles.read',
      'editorial.profile.activity.read',
      'editorial.profile.totals.read',
    ],
    admin: ['*'],
    'editorial:publisher': apps,
    'editorial:moderator': ['editorial.app.update', 'editorial.app.delete'],
    'editorial:taxonomy': taxonomy,
    'editorial:reviewer': [
      'editorial.release.review',
      'editorial.article.review',
      'editorial.suite.review',
      'editorial.application.review',
    ],
    'editorial:ownership-reviewer': ownershipReview,
  },
  resourceConstraints: Object.fromEntries(
    [
      'editorial.health.configure',
      'editorial.health.probe',
      'editorial.explore.read',
      'editorial.favorite-updates.read',
      'editorial.account-export.read',
      'editorial.account-erasure.request',
      'editorial.profile.suites.read',
      'editorial.profile.articles.read',
      'editorial.profile.activity.read',
      'editorial.profile.totals.read',
      ...apps,
      ...taxonomy,
      ...suites,
      ...releases,
      ...articles,
      ...applicationDrafts,
      ...applicationPublication,
      ...applicationImages,
      ...articleCovers,
      ...ownership,
      ...ownershipReview,
      'editorial.application.review',
      'editorial.suite.review',
      'editorial.release.review',
      'editorial.article.review',
    ].map((action) => {
      if (action === 'editorial.health.configure')
        return [
          action,
          {
            type: 'application-health',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (action === 'editorial.health.probe')
        return [
          action,
          {
            type: 'health-worker',
            exactId: 'editorial',
            requireId: true,
            tenantMustMatchInput: true,
            serviceOnly: {
              identityId: 'wapps-health-monitor',
              tenantId: 'health',
              role: 'health:monitor',
            },
          },
        ];
      if (action === 'editorial.explore.read')
        return [
          action,
          {
            type: 'explore',
            exactId: 'editorial',
            requireId: true,
            tenantMustMatchInput: true,
            serviceOnly: {
              identityId: 'wapps-explore-reader',
              tenantId: 'explore',
              role: 'explore:reader',
            },
          },
        ];
      if (action === 'editorial.account-erasure.request')
        return [
          action,
          {
            type: 'account-erasure',
            requireId: true,
            tenantMustMatchInput: true,
            serviceOnly: {
              identityId: 'wapps-account-erasure-writer',
              tenantId: 'account-erasure',
              role: 'account-erasure:writer',
            },
          },
        ];
      if (action === 'editorial.favorite-updates.read')
        return [
          action,
          {
            type: 'favorite-updates',
            exactId: 'editorial',
            requireId: true,
            tenantMustMatchInput: true,
            serviceOnly: {
              identityId: 'wapps-notification-worker',
              tenantId: 'notifications',
              role: 'notification:worker',
            },
          },
        ];
      if (action === 'editorial.account-export.read')
        return [
          action,
          {
            type: 'account-export',
            requireId: true,
            tenantMustMatchInput: true,
            serviceOnly: {
              identityId: 'wapps-account-export-reader',
              tenantId: 'account-export',
              role: 'account-export:reader',
            },
          },
        ];
      if (action === 'editorial.profile.totals.read')
        return [
          action,
          {
            type: 'profile-totals',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (action === 'editorial.profile.activity.read')
        return [
          action,
          {
            type: 'profile-activity',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (action === 'editorial.profile.articles.read')
        return [
          action,
          {
            type: 'profile-article-collection',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (action === 'editorial.profile.suites.read')
        return [
          action,
          {
            type: 'profile-suite-collection',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (articles.includes(action) || action === 'editorial.article.review')
        return [
          action,
          {
            type:
              action === 'editorial.article.review'
                ? 'article-review'
                : 'article-workspace',
            requireId: true,
            identityMustMatchInput: action !== 'editorial.article.review',
            tenantMustMatchInput: true,
          },
        ];
      if (releases.includes(action) || action === 'editorial.release.review')
        return [
          action,
          {
            type:
              action === 'editorial.release.review'
                ? 'release-review'
                : 'release-workspace',
            requireId: true,
            identityMustMatchInput: action !== 'editorial.release.review',
            tenantMustMatchInput: true,
          },
        ];
      if (articleCovers.includes(action))
        return [
          action,
          {
            type: 'article-cover-workspace',
            requireId: true,
            identityMustMatchInput: true,
            tenantMustMatchInput: true,
          },
        ];
      if (applicationImages.includes(action))
        return [
          action,
          {
            type: 'application-image-workspace',
            requireId: true,
            identityMustMatchInput: true,
            tenantMustMatchInput: true,
          },
        ];
      if (ownershipReview.includes(action))
        return [
          action,
          {
            type: 'ownership-review',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (ownership.includes(action))
        return [
          action,
          {
            type: 'ownership-workspace',
            requireId: true,
            identityMustMatchInput: true,
            tenantMustMatchInput: true,
          },
        ];
      if (
        action === 'editorial.suite.review' ||
        action === 'editorial.application.review'
      )
        return [
          action,
          {
            type:
              action === 'editorial.suite.review'
                ? 'suite-review'
                : 'application-review',
            requireId: true,
            tenantMustMatchInput: true,
          },
        ];
      if (
        suites.includes(action) ||
        applicationDrafts.includes(action) ||
        applicationPublication.includes(action)
      )
        return [
          action,
          {
            type: suites.includes(action)
              ? 'suite-workspace'
              : 'application-workspace',
            requireId: true,
            identityMustMatchInput: true,
            tenantMustMatchInput: true,
          },
        ];
      const [, type, operation] = action.split('.');
      return [
        action,
        {
          type,
          requireId: operation !== 'create',
          tenantMustMatchInput: true,
        },
      ];
    })
  ),
};
