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
  },
};
