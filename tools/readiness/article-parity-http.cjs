const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

function articleParityHttp(origin) {
  async function request(
    route,
    {
      actor,
      at = origin,
      body,
      method,
      key,
      headers = {},
      status = 200,
      binary = false,
    } = {}
  ) {
    const response = await fetch(at + route, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
        ...(body === undefined
          ? {}
          : {
              'Content-Type': Buffer.isBuffer(body)
                ? 'application/octet-stream'
                : 'application/json',
            }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(70000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method ?? 'request'} ${route}: HTTP ${
        response.status
      }, expected ${status}: ${bytes.toString().slice(0, 240)}`
    );
    if (response.ok)
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    if (response.status === 503)
      assert.equal(response.headers.get('retry-after'), '2');
    if (binary && response.ok) {
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(
        response.headers.get('content-security-policy')?.includes('sandbox')
      );
      assert.ok(
        response.headers.get('vary')?.toLowerCase().includes('authorization')
      );
      return bytes;
    }
    const text = bytes.toString();
    return text.startsWith('{') || text.startsWith('[')
      ? JSON.parse(text)
      : text;
  }
  const change = (route, actor, body, options = {}) =>
    request(route, {
      actor,
      body,
      key: randomUUID(),
      status: options.method && options.method !== 'POST' ? 200 : 201,
      ...options,
    });
  async function until(check, label) {
    let last;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        return await check();
      } catch (error) {
        last = error;
        await delay(100);
      }
    }
    throw new Error(label, { cause: last });
  }
  return { request, change, until };
}

module.exports = { articleParityHttp };
