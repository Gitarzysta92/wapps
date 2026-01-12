export default {
  async find(ctx) {
    return await strapi.entityService.findMany('api::store.store', {
      ...ctx.query,
    });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    return await strapi.entityService.findOne('api::store.store', id, {
      ...ctx.query,
    });
  },
};
