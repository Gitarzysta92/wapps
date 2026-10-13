const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const sharp = require('sharp');

async function qualifyPublicProfilesHttp({ accountOrigin, opaOrigin, headers, identities }) {
  const alice = 'PublicAlice'; const bob = 'PublicBob'; const other = 'PublicOther';
  for (const uid of [alice, bob, other]) {
    await identities.ensure({ uid, kind: 'user', provider: 'email', activate: true });
    await identities.enrollAccount(uid, uid, 'public-enroll');
  }
  const ownerId = (await identities.find(alice)).subjectId;
  const requesterId = (await identities.find(bob)).subjectId;
  const visibility = async value => {
    const saved = await identities.getPreferences(alice);
    saved.preferences.privacy.profileVisibility = value;
    await identities.updatePreferences(alice, { expectedRevision: saved.revision, preferences: saved.preferences }, randomUUID());
  };
  const anonymous = { 'x-ingress-auth': headers(alice)['x-ingress-auth'], 'x-anonymous': 'true' };
  const call = (uid, path = `/api/profiles/${ownerId}`, options = {}) => fetch(`${accountOrigin()}${path}`, { ...options, headers: { ...(uid ? headers(uid) : anonymous), ...options.headers }, signal: AbortSignal.timeout(8000) });
  const change = (uid, action, expectedRevision, key = randomUUID()) => call(uid, '/api/me/profile-follows', { method: 'PUT', headers: { 'idempotency-key': key }, body: JSON.stringify({ ownerId, requesterId, action, expectedRevision }) });
  assert.equal((await call(null)).status, 404);
  assert.equal((await call(alice)).status, 200);
  const admin = await call(other, undefined, { headers: { 'x-user-claims': '{"roles":["admin","identity:admin"]}' } });
  assert.equal(admin.status, 404, 'Staff cannot bypass private audience policy');
  assert.equal((await change(bob, 'request', 0)).status, 403);
  await visibility('public');
  let response = await call(null);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload.profile).sort(), ['avatarId', 'bio', 'contactEmail', 'id', 'location', 'name', 'registeredAt', 'socialLinks']);
  assert.equal(payload.profile.id, ownerId);
  assert.equal(payload.profile.name, alice);
  assert.equal(payload.follow, null);
  const profile = await (await call(alice, '/api/me/profile')).json();
  const contact = { expectedRevision: profile.revision, name: profile.profile.name, bio: null, location: null, socialLinks: {}, contactEmail: 'Public.Contact@EXAMPLE.Test' };
  assert.equal((await call(alice, '/api/me/profile', { method: 'PUT', headers: { 'idempotency-key': randomUUID() }, body: JSON.stringify({ ...contact, contactEmail: 'a@example.test\r\nBcc:b@example.test' }) })).status, 400);
  const contactKey = randomUUID();
  const contactResponse = await call(alice, '/api/me/profile', { method: 'PUT', headers: { 'idempotency-key': contactKey }, body: JSON.stringify(contact) });
  assert.equal(contactResponse.status, 200);
  const contactReceipt = await contactResponse.json();
  assert.equal((await (await call(null)).json()).profile.contactEmail, null);
  const preference = await identities.getPreferences(alice);
  preference.preferences.privacy.showEmail = true;
  await identities.updatePreferences(alice, { expectedRevision: preference.revision, preferences: preference.preferences }, randomUUID());
  assert.equal((await (await call(null)).json()).profile.contactEmail, 'Public.Contact@example.test');
  assert.deepEqual(await (await call(alice, '/api/me/profile', { method: 'PUT', headers: { 'idempotency-key': contactKey }, body: JSON.stringify(contact) })).json(), contactReceipt);
  const directory = await (await call(null, '/api/profiles')).json();
  assert.equal(directory.profiles.some(profile => profile.id === ownerId), true);
  assert.equal(directory.profiles.find(profile => profile.id === ownerId).contactEmail, null, 'Directory omits contact addresses');
  assert.equal((await fetch(`${accountOrigin()}/api/profiles/${ownerId}`)).status, 401);
  assert.equal((await call(null, undefined, { headers: { authorization: 'Bearer invalid' } })).status, 401);
  const bytes = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#197b77' } }).png().toBuffer();
  const revision = (await identities.getProfile(alice)).revision;
  const upload = await call(alice, '/api/me/profile/avatar', { method: 'PUT', headers: { 'content-type': 'image/png', 'if-match': `"${revision}"`, 'idempotency-key': randomUUID(), 'x-avatar-bytes': String(bytes.length), 'x-avatar-sha256': createHash('sha256').update(bytes).digest('hex') }, body: bytes });
  assert.equal(upload.status, 200);
  const avatarId = (await identities.getProfile(alice)).profile.avatarId;
  const photoPath = `/api/profiles/${ownerId}/avatar/${avatarId}`;
  response = await call(null, photoPath);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok((await response.arrayBuffer()).byteLength > 12);
  await visibility('followers');
  assert.equal((await call(null, photoPath)).status, 404);
  const gate = await (await call(null)).json();
  assert.deepEqual(gate, { access: 'followers', profile: null, isOwner: false, follow: null });
  const requestKey = randomUUID(); response = await change(bob, 'request', 0, requestKey);
  assert.equal(response.status, 200); const pending = await response.json();
  assert.equal((await (await call(bob)).json()).profile, null);
  assert.equal((await change(bob, 'approve', 1)).status, 403);
  assert.equal((await change(other, 'approve', 1)).status, 403);
  const inbox = await (await call(alice, '/api/me/profile-follows')).json();
  assert.deepEqual(inbox.followers, [{ ...pending, requesterName: bob }]);
  const approveKey = randomUUID(); response = await change(alice, 'approve', 1, approveKey);
  assert.equal(response.status, 200); const approved = await response.json();
  assert.equal((await (await call(bob)).json()).profile.name, alice);
  assert.equal((await (await call(bob)).json()).profile.contactEmail, 'Public.Contact@example.test');
  assert.equal((await call(bob, photoPath)).status, 200);
  assert.equal((await call(other, photoPath)).status, 404);
  assert.equal((await change(alice, 'remove', 2)).status, 200);
  assert.equal((await call(bob, photoPath)).status, 404);
  assert.deepEqual(await (await change(alice, 'approve', 1, approveKey)).json(), approved);
  assert.deepEqual(await (await change(bob, 'request', 0, requestKey)).json(), pending);
  assert.equal((await (await call(bob)).json()).profile, null);
  assert.equal((await change(alice, 'approve', 1)).status, 409);
  assert.equal((await change(bob, 'request', 3)).status, 200);
  await visibility('private');
  assert.equal((await call(bob)).status, 404);
  const outgoing = await (await call(bob, '/api/me/profile-follows/outgoing')).json();
  assert.deepEqual(outgoing.following, [{ ...pending, revision: 4 }]);
  await identities.setSuspended(alice, true);
  assert.equal((await change(bob, 'cancel', 4)).status, 200);
  await identities.setSuspended(alice, false);
  await visibility('public');
  await identities.setSuspended(bob, true);
  assert.equal((await call(bob)).status, 401);
  await identities.setSuspended(bob, false);
  const policies = await (await fetch(`${opaOrigin}/v1/policies`)).json();
  const policy = policies.result.find(item => item.raw.includes('package wapps.profile_audience.authz') && item.raw.includes('default allow := false'));
  assert.ok(policy, 'Real audience policy must be loaded');
  assert.equal((await fetch(`${opaOrigin}/v1/policies/${encodeURIComponent(policy.id)}`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'package wapps.profile_audience.authz\ndefault allow := null\n' })).status, 200);
  try { assert.equal((await call(null)).status, 503, 'Invalid audience policy result must fail closed'); }
  finally { assert.equal((await fetch(`${opaOrigin}/v1/policies/${encodeURIComponent(policy.id)}`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: policy.raw })).status, 200); }
  assert.equal((await call(null)).status, 200);
  console.log('Public profile HTTP: compiled API, real OPA/SQL, anonymous/current sessions, private/follower/public audiences, protected photos, staff denial, approval/revocation, historical retry and policy loss passed.');
  return {
    restored: async () => { assert.equal((await (await call(null)).json()).profile.contactEmail, 'Public.Contact@example.test'); assert.equal((await call(null, photoPath)).status, 200); },
    policyUnavailable: async () => { assert.equal((await call(null)).status, 503); assert.equal((await call(null, photoPath)).status, 503); },
  };
}
module.exports = { qualifyPublicProfilesHttp };
