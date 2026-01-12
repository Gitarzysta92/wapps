export default {
  async find(ctx) {
    return await strapi.entityService.findMany('api::monetization-model.monetization-model', {
      ...ctx.query,
    });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    return await strapi.entityService.findOne('api::monetization-model.monetization-model', id, {
      ...ctx.query,
    });
  },
};
