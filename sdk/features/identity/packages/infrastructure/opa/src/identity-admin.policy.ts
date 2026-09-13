import { DiscussionPolicyDefinition } from './types';

/**
 * Identity admin authorization policy definition (TypeScript source-of-truth).
 *
 * This is compiled into an OPA bundle:
 * - `libs/utils/opa/bundles/identity-admin/data.json`
 * - `libs/utils/opa/bundles/identity-admin/policy.rego`
 */
export const identityAdminPolicy: DiscussionPolicyDefinition = {
  packageName: 'wapps.identity_admin.authz',
  supportedActions: [
    'identity.graph.read',
    'identity.user.disable',
    'identity.user.enable',
    'identity.user.revoke_tokens',
    'identity.user.delete',
    'identity.user.update_email',
    'identity.user.update_password',
    'identity.user.unlink_provider',
    'identity.user.generate_password_reset_link',
    'identity.user.generate_email_verification_link',
  ],
  rolePermissions: {
    admin: ['*'],
    'identity:admin': [
      'identity.graph.read',
      'identity.user.disable',
      'identity.user.enable',
      'identity.user.revoke_tokens',
      'identity.user.delete',
      'identity.user.update_email',
      'identity.user.update_password',
      'identity.user.unlink_provider',
      'identity.user.generate_password_reset_link',
      'identity.user.generate_email_verification_link',
    ],
  },
  resourceConstraints: {
    'identity.graph.read': { type: 'user', requireId: true },
    'identity.user.disable': { type: 'user', requireId: true },
    'identity.user.enable': { type: 'user', requireId: true },
    'identity.user.revoke_tokens': { type: 'user', requireId: true },
    'identity.user.delete': { type: 'user', requireId: true },
    'identity.user.update_email': { type: 'user', requireId: true },
    'identity.user.update_password': { type: 'user', requireId: true },
    'identity.user.unlink_provider': { type: 'user', requireId: true },
    'identity.user.generate_password_reset_link': { type: 'user', requireId: true },
    'identity.user.generate_email_verification_link': { type: 'user', requireId: true },
  },
  rolesByIdentityExample: {
    'example-admin': ['identity:admin'],
  },
};

