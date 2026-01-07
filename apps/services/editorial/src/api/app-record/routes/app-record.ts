export default {
  routes: [
    {
      method: 'GET',
      path: '/app-records',
      handler: 'app-record.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/app-records/:id',
      handler: 'app-record.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/app-records',
      handler: 'app-record.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/app-records/:id',
      handler: 'app-record.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/app-records/:id',
      handler: 'app-record.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

