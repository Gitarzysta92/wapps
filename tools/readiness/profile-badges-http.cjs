const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function qualifyProfileBadgesHttp({ accountOrigin, headers, identities, duringBadgePolicy }) {
  const staff = 'HttpBadgeStaff', owner = 'HttpBadgeOwner', follower = 'HttpBadgeFollower';
  for (const uid of [staff, owner, follower]) {
    await identities.ensure({ uid, kind: 'user', provider: 'email', activate: true });
    await identities.enrollAccount(uid, uid, randomUUID());
  }
  const id = (await identities.getProfile(owner)).publicId, requesterId = (await identities.getProfile(follower)).publicId;
  const admin = `/api/admin/profile-badges/${id}`, shared = `/api/profiles/${id}/badges`;
  const anonymous = { 'x-ingress-auth': headers(owner)['x-ingress-auth'], 'x-anonymous': 'true' };
  const call = (uid, endpoint, options = {}) => fetch(`${accountOrigin()}${endpoint}`, { ...options, headers: { ...(uid ? headers(uid) : anonymous), ...(uid === staff ? { 'x-user-claims': '{"roles":["identity:badge-manager"]}' } : {}), ...options.headers }, signal: AbortSignal.timeout(8000) });
  const put = (uid, endpoint, body, key = randomUUID()) => call(uid, endpoint, { method: 'PUT', headers: { 'idempotency-key': key }, body: JSON.stringify(body) });
  const data = async response => { assert.equal(response.status, 200, await response.clone().text()); return response.json(); };
  const preferences = async (visibility, showBadges) => {
    const saved = await identities.getPreferences(owner);
    await identities.updatePreferences(owner, { expectedRevision: saved.revision, preferences: { ...saved.preferences, privacy: { ...saved.preferences.privacy, profileVisibility: visibility, showBadges } } }, randomUUID());
  };
  assert.equal((await call(owner, '/api/admin/profile-badges')).status, 403);
  assert.equal((await call(owner, admin)).status, 403);
  assert.equal((await call(null, admin)).status, 401);
  assert.deepEqual(await data(await call(staff, '/api/admin/profile-badges')), { kinds: ['verified', 'premium'] });
  const command = { expectedRevision: 0, kind: 'verified', action: 'award', reason: 'Staff reviewed the evidence' }, key = randomUUID();
  assert.equal((await put(owner, admin, command)).status, 403);
  for (const malformed of [{ ...command, actorId: requesterId }, { ...command, tenantId: 'forged' }, { ...command, reason: '' }]) assert.equal((await put(staff, admin, malformed)).status, 400);
  const event = await data(await put(staff, admin, command, key));
  assert.equal(event.revision, 1); assert.equal(event.actorId, (await identities.getProfile(staff)).publicId);
  assert.deepEqual(await data(await put(staff, admin, command, key)), event);
  assert.equal((await put(staff, admin, { ...command, reason: 'Conflicting reason' }, key)).status, 409);
  assert.equal((await call(null, shared)).status, 404);
  assert.equal((await call(staff, shared)).status, 404, 'Badge staff does not bypass private profile audience');
  await preferences('public', true);
  const publicResponse = await call(null, shared);
  assert.equal(publicResponse.headers.get('cache-control'), 'private, no-store'); assert.equal(publicResponse.headers.get('vary'), 'Authorization');
  assert.deepEqual(await data(publicResponse), { sharing: 'visible', items: [{ kind: 'verified', awardedAt: event.at }] });
  duringBadgePolicy(() => preferences('public', false));
  assert.equal((await call(null, shared)).status, 404, 'A sharing change during a real policy response invalidates the previously readable snapshot');
  assert.deepEqual(await data(await call(null, shared)), { sharing: 'hidden', items: [] });
  assert.deepEqual(await data(await call(owner, shared)), { sharing: 'hidden', items: [] }, 'Owner public preview respects Show Badges');
  assert.equal((await data(await call(owner, '/api/me/badges'))).items.length, 1);
  await preferences('followers', true);
  assert.equal((await call(follower, shared)).status, 404);
  const follow = { ownerId: id, requesterId, expectedRevision: 0, action: 'request' };
  await data(await put(follower, '/api/me/profile-follows', follow));
  await data(await put(owner, '/api/me/profile-follows', { ...follow, expectedRevision: 1, action: 'approve' }));
  assert.equal((await data(await call(follower, shared))).items.length, 1);
  await data(await put(owner, '/api/me/profile-follows', { ...follow, expectedRevision: 2, action: 'remove' }));
  assert.equal((await call(follower, shared)).status, 404);
  duringBadgePolicy(async () => { await data(await put(staff, admin, { ...command, expectedRevision: 1, action: 'revoke', reason: 'Evidence no longer valid' })); });
  assert.equal((await call(owner, shared)).status, 404, 'A concurrent revocation cannot leak the previously active badge');
  assert.deepEqual(await data(await put(staff, admin, command, key)), event);
  assert.equal((await data(await call(owner, '/api/me/badges'))).items.length, 0);
  const audit = await data(await call(staff, admin));
  assert.deepEqual(audit.events.map(event => event.action), ['revoke', 'award']);
  await identities.setSuspended(staff, true);
  assert.equal((await call(staff, admin)).status, 401);
  await identities.setSuspended(staff, false);
  await preferences('public', true);
  console.log('Badge HTTP: real staff policy, owner/staff separation, strict input, exact receipts, immutable audit, public/private/follower audiences, sharing, suspension and no-store passed.');
  return {
    restored: async () => { assert.deepEqual(await data(await call(staff, admin)), audit); assert.deepEqual(await data(await call(null, shared)), { sharing: 'visible', items: [] }); },
    policyUnavailable: async () => { assert.equal((await call(staff, admin)).status, 503); assert.equal((await call(null, shared)).status, 503); },
  };
}
module.exports = { qualifyProfileBadgesHttp };
