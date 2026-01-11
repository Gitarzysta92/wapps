export default {
  async find(ctx) {
    return await strapi.entityService.findMany('api::user-span.user-span', {
      ...ctx.query,
    });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    return await strapi.entityService.findOne('api::user-span.user-span', id, {
      ...ctx.query,
    });
  },
};
