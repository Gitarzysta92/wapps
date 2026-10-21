import { DiscussionPolicyDefinition } from './types';

/**
 * Identity admin authorization policy definition (TypeScript source-of-truth).
 *
 * This is compiled into an OPA bundle:
 * - `sdk/features/identity/packages/infrastructure/opa/bundles/identity-admin/data.json`
 * - `sdk/features/identity/packages/infrastructure/opa/bundles/identity-admin/policy.rego`
 */
export const identityAdminPolicy: DiscussionPolicyDefinition = {
  packageName: 'wapps.identity_admin.authz',
  supportedActions: [
    'identity.mention-recipients.read',
    'identity.account-export.manage',
    'identity.notifications.read',
    'identity.notifications.update',
    'identity.profile-badges.read',
    'identity.profile-badges.update',
    'identity.profile-follows.read',
    'identity.profile-follows.update',
    'identity.favorites.read',
    'identity.favorites.update',
    'identity.preferences.read',
    'identity.preferences.update',
    'identity.profile.read',
    'identity.profile.update',
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
  selfActions: [
    'identity.account-export.manage',
    'identity.notifications.read',
    'identity.notifications.update',
    'identity.profile-follows.read',
    'identity.profile-follows.update',
    'identity.favorites.read',
    'identity.favorites.update',
    'identity.profile.read',
    'identity.profile.update',
    'identity.preferences.read',
    'identity.preferences.update',
  ],
  rolePermissions: {
    'notification:worker': ['identity.mention-recipients.read'],
    'identity:badge-manager': [
      'identity.profile-badges.read',
      'identity.profile-badges.update',
    ],
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
    'identity.mention-recipients.read': {
      type: 'mention-recipients',
      exactId: 'account',
      requireId: true,
      tenantMustMatchInput: true,
      serviceOnly: {
        identityId: 'wapps-notification-worker',
        tenantId: 'notifications',
        role: 'notification:worker',
      },
    },
    'identity.notifications.read': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.notifications.update': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.account-export.manage': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.profile-badges.read': {
      type: 'profile-badges',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.profile-badges.update': {
      type: 'profile-badges',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.profile-follows.read': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.profile-follows.update': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.favorites.read': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.favorites.update': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.preferences.read': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.preferences.update': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.profile.read': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.profile.update': {
      type: 'user',
      requireId: true,
      identityMustMatchInput: true,
    },
    'identity.graph.read': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.disable': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.enable': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.revoke_tokens': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.delete': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.update_email': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.update_password': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.unlink_provider': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.generate_password_reset_link': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
    'identity.user.generate_email_verification_link': {
      type: 'user',
      requireId: true,
      tenantMustBeAbsent: true,
    },
  },
};
