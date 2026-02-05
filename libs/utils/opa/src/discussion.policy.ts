import { DiscussionPolicyDefinition } from './types';

/**
 * Discussion authorization policy definition (TypeScript source-of-truth).
 *
 * This is compiled into an OPA bundle:
 * - `libs/utils/opa/bundles/discussion/data.json`
 * - `libs/utils/opa/bundles/discussion/policy.rego`
 */
export const discussionPolicy: DiscussionPolicyDefinition = {
  packageName: 'wapps.discussion.authz',
  supportedActions: [
    'create-discussion',
    'create-comment',
    'discussion.comment.like',
    'discussion.comment.unlike',
  ],
  rolePermissions: {
    admin: ['*'],
    'discussion:writer': [
      'create-discussion',
      'create-comment',
      'discussion.comment.like',
      'discussion.comment.unlike',
    ],
    'discussion:reader': ['discussion.comment.like', 'discussion.comment.unlike'],
  },
  resourceConstraints: {
    'discussion.comment.like': {
      type: 'comment',
      requireId: true,
    },
    'discussion.comment.unlike': {
      type: 'comment',
      requireId: true,
    },
  },
  rolesByIdentityExample: {
    'example-user': ['discussion:writer'],
  },
};

