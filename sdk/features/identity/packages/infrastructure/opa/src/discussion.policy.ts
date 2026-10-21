import { DiscussionPolicyDefinition } from './types';

const articleCommentActions = [
  'discussion.article-comment.create',
  'discussion.article-comment.reply',
  'discussion.article-comment.update',
  'discussion.article-comment.delete',
];
const applicationTopicActions = [
  'discussion.application-topic.vote',
  'discussion.application-topic.create',
  'discussion.application-topic.reply',
  'discussion.application-topic.update',
  'discussion.application-topic.delete',
];
const reviewActions = [
  'review.read',
  'review.publish',
  'review.withdraw',
  'review.helpful',
  'review.report',
];

/**
 * Discussion authorization policy definition (TypeScript source-of-truth).
 *
 * This is compiled into an OPA bundle:
 * - `sdk/features/identity/packages/infrastructure/opa/bundles/discussion/data.json`
 * - `sdk/features/identity/packages/infrastructure/opa/bundles/discussion/policy.rego`
 */
export const discussionPolicy: DiscussionPolicyDefinition = {
  packageName: 'wapps.discussion.authz',
  supportedActions: [
    'discussion.explore.read',
    'discussion.notifications.manage',
    'discussion.mentions.manage',
    'discussion.favorite-updates.read',
    'discussion.account-export.read',
    'discussion.account-erasure.request',
    'discussion.profile.participation.read',
    'discussion.profile.activity.read',
    'discussion.profile.totals.read',
    'review.moderate',
    ...reviewActions,
    'discussion.application-topic.pin',
    'discussion.my-topics.read',
    ...articleCommentActions,
    ...applicationTopicActions,
    'create-discussion',
    'create-comment',
    'discussion.update',
    'discussion.delete',
    'discussion.comment.like',
    'discussion.comment.unlike',
  ],
  selfActions: [
    ...reviewActions,
    'discussion.my-topics.read',
    ...articleCommentActions,
    ...applicationTopicActions,
  ],
  rolePermissions: {
    'explore:reader': ['discussion.explore.read'],
    'notification:worker': [
      'discussion.notifications.manage',
      'discussion.mentions.manage',
      'discussion.favorite-updates.read',
    ],
    'account-erasure:writer': ['discussion.account-erasure.request'],
    'account-export:reader': ['discussion.account-export.read'],
    'discussion:profile-reader': [
      'discussion.profile.participation.read',
      'discussion.profile.activity.read',
      'discussion.profile.totals.read',
    ],
    admin: ['*'],
    'discussion:writer': [
      'create-discussion',
      'create-comment',
      'discussion.update',
      'discussion.delete',
      'discussion.comment.like',
      'discussion.comment.unlike',
    ],
    'discussion:reader': [
      'discussion.comment.like',
      'discussion.comment.unlike',
    ],
  },
  resourceConstraints: {
    'discussion.explore.read': { type: 'explore', exactId: 'discussion', requireId: true, tenantMustMatchInput: true, serviceOnly: { identityId: 'wapps-explore-reader', tenantId: 'explore', role: 'explore:reader' } },
    'discussion.favorite-updates.read': {
      type: 'favorite-updates',
      exactId: 'discussion',
      requireId: true,
      tenantMustMatchInput: true,
      serviceOnly: {
        identityId: 'wapps-notification-worker',
        tenantId: 'notifications',
        role: 'notification:worker',
      },
    },
    'discussion.notifications.manage': {
      type: 'reply-notifications',
      exactId: 'discussion',
      requireId: true,
      tenantMustMatchInput: true,
      serviceOnly: {
        identityId: 'wapps-notification-worker',
        tenantId: 'notifications',
        role: 'notification:worker',
      },
    },
    'discussion.mentions.manage': {
      type: 'mention-notifications',
      exactId: 'discussion',
      requireId: true,
      tenantMustMatchInput: true,
      serviceOnly: {
        identityId: 'wapps-notification-worker',
        tenantId: 'notifications',
        role: 'notification:worker',
      },
    },
    'discussion.account-erasure.request': {
      type: 'account-erasure',
      requireId: true,
      tenantMustMatchInput: true,
      serviceOnly: {
        identityId: 'wapps-account-erasure-writer',
        tenantId: 'account-erasure',
        role: 'account-erasure:writer',
      },
    },
    'discussion.account-export.read': {
      type: 'account-export',
      requireId: true,
      tenantMustMatchInput: true,
      serviceOnly: {
        identityId: 'wapps-account-export-reader',
        tenantId: 'account-export',
        role: 'account-export:reader',
      },
    },
    'discussion.profile.totals.read': {
      type: 'profile-totals',
      requireId: true,
      tenantMustMatchInput: true,
    },
    'discussion.profile.activity.read': {
      type: 'profile-activity',
      requireId: true,
      tenantMustMatchInput: true,
    },
    'discussion.profile.participation.read': {
      type: 'profile-discussion-collection',
      requireId: true,
      tenantMustMatchInput: true,
    },
    ...Object.fromEntries(
      [...reviewActions, 'review.moderate'].map((action) => [
        action,
        {
          type: 'application-review-workspace',
          requireId: true,
          tenantMustMatchInput: true,
          identityMustMatchInput: true,
        },
      ])
    ),
    'discussion.application-topic.pin': {
      type: 'application-topic-workspace',
      requireId: true,
      tenantMustMatchInput: true,
      identityMustMatchInput: true,
    },
    'discussion.my-topics.read': {
      type: 'my-discussion-workspace',
      requireId: true,
      tenantMustMatchInput: true,
      identityMustMatchInput: true,
    },
    ...Object.fromEntries(
      applicationTopicActions.map((action) => [
        action,
        {
          type: 'application-topic-workspace',
          requireId: true,
          tenantMustMatchInput: true,
          identityMustMatchInput: true,
        },
      ])
    ),
    ...Object.fromEntries(
      articleCommentActions.map((action) => [
        action,
        {
          type: 'article-comment-workspace',
          requireId: true,
          tenantMustMatchInput: true,
          identityMustMatchInput: true,
        },
      ])
    ),
    'discussion.comment.like': {
      type: 'comment',
      requireId: true,
    },
    'discussion.comment.unlike': {
      type: 'comment',
      requireId: true,
    },
  },
};
