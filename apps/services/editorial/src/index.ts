// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: any }) {
    // Set permissions for API token access
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (publicRole) {
      const permissions = [
        // App Record permissions
        {
          action: 'api::app-record.app-record.find',
          enabled: true,
        },
        {
          action: 'api::app-record.app-record.findOne',
          enabled: true,
        },
        {
          action: 'api::app-record.app-record.create',
          enabled: true,
        },
        {
          action: 'api::app-record.app-record.update',
          enabled: true,
        },
        // Tag permissions
        {
          action: 'api::tag.tag.find',
          enabled: true,
        },
        {
          action: 'api::tag.tag.findOne',
          enabled: true,
        },
        {
          action: 'api::tag.tag.create',
          enabled: true,
        },
        {
          action: 'api::tag.tag.update',
          enabled: true,
        },
        // Upload permissions
        {
          action: 'plugin::upload.content-api.upload',
          enabled: true,
        },
      ];

      for (const permission of permissions) {
        const existing = await strapi
          .query('plugin::users-permissions.permission')
          .findOne({
            where: {
              action: permission.action,
              role: publicRole.id,
            },
          });

        if (existing) {
          await strapi
            .query('plugin::users-permissions.permission')
            .update({
              where: { id: existing.id },
              data: { enabled: permission.enabled },
            });
        } else {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: permission.action,
              role: publicRole.id,
              enabled: permission.enabled,
            },
          });
        }
      }

      console.log('✅ Public role permissions configured for API access');
    }

    // Configure API token permissions
    // Find all API tokens and ensure they have proper permissions
    try {
      const apiTokens = await strapi.query('admin::api-token').findMany({
        populate: ['permissions'],
      });

      // Filter to only tokens that need permission configuration (not full-access)
      const tokensNeedingConfig = apiTokens.filter(
        (token) => token.type !== 'full-access'
      );

      const apiTokenPermissions = [
        // App Record permissions
        'api::app-record.app-record.find',
        'api::app-record.app-record.findOne',
        'api::app-record.app-record.create',
        'api::app-record.app-record.update',
        'api::app-record.app-record.delete',
        // Tag permissions
        'api::tag.tag.find',
        'api::tag.tag.findOne',
        'api::tag.tag.create',
        'api::tag.tag.update',
        'api::tag.tag.delete',
        // Upload permissions
        'plugin::upload.content-api.upload',
        'plugin::upload.content-api.find',
      ];

      for (const token of tokensNeedingConfig) {
        // Update token to custom type if it's read-only
        if (token.type === 'read-only') {
          await strapi.query('admin::api-token').update({
            where: { id: token.id },
            data: { type: 'custom' },
          });
          console.log(`📝 Updated API token "${token.name}" from read-only to custom`);
        }

        // Ensure all required permissions exist for this token
        for (const action of apiTokenPermissions) {
          const existingPermission = await strapi
            .query('admin::api-token-permission')
            .findOne({
              where: {
                action: action,
                token: token.id,
              },
            });

          if (!existingPermission) {
            await strapi.query('admin::api-token-permission').create({
              data: {
                action: action,
                token: token.id,
              },
            });
          }
        }

        console.log(`✅ Configured permissions for API token: ${token.name}`);
      }

      if (tokensNeedingConfig.length > 0) {
        console.log(
          `✅ Configured permissions for ${tokensNeedingConfig.length} API token(s)`
        );
      } else if (apiTokens.length > 0) {
        console.log(
          `ℹ️  Found ${apiTokens.length} API token(s), all have full-access`
        );
      }
    } catch (error) {
      console.warn('⚠️  Could not configure API token permissions:', error);
      // This might fail if API tokens don't exist yet, which is okay
    }
  },
};
