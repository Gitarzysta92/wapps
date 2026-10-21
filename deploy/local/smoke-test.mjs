import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function request(url, body, headers = {}) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert(
    response.ok,
    `${url}: HTTP ${response.status} ${await (!response.ok
      ? response.text()
      : '')}`
  );
  return response;
}

for (const port of [4200, 4201, 4202, 4203]) {
  assert.match(
    await (await request(`http://localhost:${port}`)).text(),
    /<html/i
  );
  console.log(`Portal ${port}: OK`);
}
for (const port of [3001, 1337, 1338, 1340, 1341]) {
  await request(`http://localhost:${port}/api/health`);
  console.log(`API ${port}: OK`);
}
await request('http://localhost:4202/api/catalog/categories');
const email = `compose-${randomUUID()}@example.test`;
const password = randomUUID();
const origin = 'http://localhost:4203';
const created = await (
  await request(
    `${origin}/auth/register`,
    {
      email,
      password,
      passwordConfirmation: password,
      nickname: 'Compose Smoke',
    },
    { 'Idempotency-Key': randomUUID() }
  )
).json();
const login = await (
  await request(`${origin}/auth/signin`, { email, password })
).json();
assert(
  login.token && login.refreshToken,
  'Login did not return session tokens'
);
const refreshed = await (
  await request(
    `${origin}/auth/refresh`,
    {
      refreshToken: login.refreshToken,
    },
    { Authorization: 'Bearer expired-access-token' }
  )
).json();
assert(refreshed.token, 'Refresh did not return a token');
const me = await (
  await request(`${origin}/api/me`, undefined, {
    Authorization: `Bearer ${refreshed.token}`,
    'X-User-Id': 'forged-user',
  })
).json();
assert.equal(
  me.uid,
  created.uid,
  'Gateway did not preserve the authenticated identity'
);
const forged = await fetch(`${origin}/api/me`, {
  headers: {
    'X-User-Id': created.uid,
    'X-Ingress-Auth':
      process.env.LOCAL_INGRESS_SECRET || 'wapps-local-ingress-secret',
  },
  signal: AbortSignal.timeout(15000),
});
assert(
  [401, 403].includes(forged.status),
  `Forged identity accepted: ${forged.status}`
);
await request(
  `${origin}/auth/signout`,
  {},
  { Authorization: `Bearer ${refreshed.token}` }
);
const revoked = await fetch(`${origin}/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: refreshed.refreshToken }),
  signal: AbortSignal.timeout(15000),
});
assert.equal(
  revoked.status,
  401,
  'Sign-out did not revoke the refresh credential'
);
console.log(
  'Local registration, BFF login/refresh/sign-out and gateway identity protection: OK'
);
console.log(
  `Smoke account ${created.uid} remains in local SQL; no existing accounts were changed.`
);
const policy = await (
  await request('http://localhost:8181/v1/data/wapps/discussion/authz/allow', {
    input: {
      identityId: 'compose-smoke',
      timestamp: Date.now(),
      actionName: 'create-comment',
      subject: { roles: ['discussion:writer'] },
    },
  })
).json();
assert.equal(policy.result, true, 'OPA failed to load Discussion permissions');
console.log('OPA permissions: OK');
for (const queue of ['discussion-projection', 'catalog-raw-media-ingestion']) {
  const credentials = Buffer.from(
    `wapps:${process.env.LOCAL_PASSWORD || 'wapps-local-password'}`
  ).toString('base64');
  const state = await (
    await request(`http://localhost:15672/api/queues/%2F/${queue}`, undefined, {
      Authorization: `Basic ${credentials}`,
    })
  ).json();
  assert(state.consumers > 0, `No worker is consuming ${queue}`);
  console.log(`Worker ${queue}: OK`);
}
