const { createServer, request: forward } = require('node:http');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const {
  AppModule,
} = require('../../apps/services/catalog-bff/src/app/app.module');
const {
  configureGenericDiscussionBody,
} = require('../../apps/services/catalog-bff/src/app/discussions/portal-generic-discussions.body');
const { processService } = require('./qualification-process.cjs');

// Older journey fixtures combine portal requests and service callbacks on one local origin.
// Keep that fixture interface, but execute portal routes through the actual BFF.
async function discussionPortalFixture(service, env) {
  const owner = new URL(service.origin);
  if (
    owner.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(owner.hostname) ||
    !env.INGRESS_AUTH_SECRET
  )
    throw new Error('Discussion fixture requires an authenticated local owner');
  let bff,
    gateway,
    stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    try {
      gateway?.closeAllConnections();
      if (gateway?.listening)
        await new Promise((resolve, reject) =>
          gateway.close((error) => (error ? reject(error) : resolve()))
        );
      await bff?.close();
    } finally {
      await service.stop();
    }
  }
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key) => (key === 'DISCUSSION_URL' ? service.origin : env[key]),
      })
      .compile();
    bff = module.createNestApplication();
    configureGenericDiscussionBody(bff);
    bff.setGlobalPrefix('api');
    await bff.listen(0, '127.0.0.1');
    const portal = new URL(await bff.getUrl());
    gateway = createServer((request, response) => {
      const path = (request.url ?? '/').split('?')[0];
      const portalRoute =
        /^\/api\/(application-discussions|article-comments|application-reviews|me\/discussions|discussion-selection|discussions)(\/|$)/i.test(
          path
        );
      const destination = portalRoute ? portal : owner;
      const headers = [...request.rawHeaders];
      if (
        portalRoute &&
        ![
          'authorization',
          'x-user-id',
          'x-user-claims',
          'x-user-email',
          'x-auth-time',
          'x-anonymous',
          'x-ingress-auth',
        ].some((name) => request.headers[name] !== undefined)
      )
        headers.push(
          'X-Ingress-Auth',
          env.INGRESS_AUTH_SECRET,
          'X-Anonymous',
          'true'
        );
      const upstream = forward(
        {
          hostname: destination.hostname,
          port: destination.port,
          path: request.url,
          method: request.method,
          headers,
        },
        (result) => {
          response.writeHead(result.statusCode ?? 503, result.headers);
          result.pipe(response);
        }
      );
      upstream.setTimeout(20000, () =>
        upstream.destroy(new Error('Fixture upstream timed out'))
      );
      upstream.on('error', () => {
        if (response.headersSent) response.destroy();
        else {
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end('{"message":"Fixture upstream unavailable"}');
        }
      });
      request.on('aborted', () => upstream.destroy());
      response.on('close', () => upstream.destroy());
      request.pipe(upstream);
    });
    await new Promise((resolve, reject) => {
      gateway.once('error', reject);
      gateway.listen(
        Number(env.WAPPS_QUALIFICATION_GATEWAY_PORT ?? 0),
        '127.0.0.1',
        resolve
      );
    });
    env.WAPPS_QUALIFICATION_GATEWAY_PORT = String(gateway.address().port);
    return {
      origin: 'http://127.0.0.1:' + gateway.address().port,
      serviceOrigin: service.origin,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function discussionProcessService(
  command,
  args,
  options,
  resolveOrigin,
  health
) {
  const service = await processService(
    command,
    args,
    options,
    resolveOrigin,
    health
  );
  try {
    return await discussionPortalFixture(service, options.env);
  } catch (error) {
    await service.stop();
    throw error;
  }
}

module.exports = { discussionPortalFixture, discussionProcessService };
