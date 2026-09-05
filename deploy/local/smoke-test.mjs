import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function request(url, body, headers = {}) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert(response.ok, `${url}: HTTP ${response.status} ${await (!response.ok ? response.text() : '')}`);
  return response;
}

for (const port of [4200, 4201, 4202, 4203]) {
  assert.match(await (await request(`http://localhost:${port}`)).text(), /<html/i);
  console.log(`Portal ${port}: OK`);
}
for (const port of [3001, 1337, 1338, 1340, 1341]) {
  await request(`http://localhost:${port}/api/health`);
  console.log(`API ${port}: OK`);
}
await request('http://localhost:4202/api/catalog/categories');
const email = `compose-${randomUUID()}@example.test`;
const password = randomUUID();
const emulator = 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:';
const created = await (await request(`${emulator}signUp?key=local-emulator-key`, {
  email, password, returnSecureToken: true,
})).json();
try {
  const login = await (await request('http://localhost:8080/auth/signin', { email, password })).json();
  assert(login.token && login.refreshToken, 'Login did not return session tokens');
  const refreshed = await (await request('http://localhost:8080/auth/refresh', {
    refreshToken: login.refreshToken,
  })).json();
  assert(refreshed.token, 'Refresh did not return a token');
  await request('http://localhost:8080/validate', undefined, { Authorization: `Bearer ${refreshed.token}` });
  const me = await (await request('http://localhost:4201/api/me', undefined, {
    Authorization: `Bearer ${refreshed.token}`,
  })).json();
  assert.equal(me.uid, created.localId, 'Gateway did not preserve the authenticated identity');
  // A forged client identity must not bypass token validation at the gateway.
  const forged = await fetch('http://localhost:1340/api/me', { headers: {
    'X-User-Id': created.localId,
    'X-Ingress-Auth': process.env.LOCAL_INGRESS_SECRET || 'wapps-local-ingress-secret',
  }, signal: AbortSignal.timeout(15000) });
  assert([401, 403].includes(forged.status), `Forged identity accepted: ${forged.status}`);
  console.log('Emulator login, refresh, account provisioning, and gateway identity protection: OK');
} finally {
  await request(`${emulator}delete?key=local-emulator-key`, { idToken: created.idToken });
}
const policy = await (await request('http://localhost:8181/v1/data/wapps/discussion/authz/allow', {
  input: { identityId: 'compose-smoke', timestamp: Date.now(), actionName: 'create-comment', subject: { roles: ['discussion:writer'] } },
})).json();
assert.equal(policy.result, true, 'OPA failed to load Discussion permissions');
console.log('OPA permissions: OK');
for (const queue of ['discussion-projection', 'catalog-raw-media-ingestion']) {
  const credentials = Buffer.from(`wapps:${process.env.LOCAL_PASSWORD || 'wapps-local-password'}`).toString('base64');
  const state = await (await request(`http://localhost:15672/api/queues/%2F/${queue}`, undefined, {
    Authorization: `Basic ${credentials}`,
  })).json();
  assert(state.consumers > 0, `No worker is consuming ${queue}`);
  console.log(`Worker ${queue}: OK`);
}
