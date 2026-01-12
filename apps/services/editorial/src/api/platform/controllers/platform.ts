export default {
  async find(ctx) {
    return await strapi.entityService.findMany('api::platform.platform', {
      ...ctx.query,
    });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    return await strapi.entityService.findOne('api::platform.platform', id, {
      ...ctx.query,
    });
  },
};
