export default {
  async find(ctx) {
    return await strapi.entityService.findMany('api::device.device', {
      ...ctx.query,
    });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    return await strapi.entityService.findOne('api::device.device', id, {
      ...ctx.query,
    });
  },
};
