export default {
  async find(ctx) {
    return await strapi.entityService.findMany('api::social.social', {
      ...ctx.query,
    });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    return await strapi.entityService.findOne('api::social.social', id, {
      ...ctx.query,
    });
  },
};
