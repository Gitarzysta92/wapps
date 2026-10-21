const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  defaultAccountPreferences,
} = require('../../libs/domains/customer/preferences/src');
const {
  MysqlCanonicalIdentities,
  AccountPreferences1791676806000,
} = require('../../libs/adapters/account-mysql/src');

async function qualifyAccountPreferences({
  source,
  configuration,
  identities,
}) {
  const alice = 'PreferencesAlice';
  const bob = 'PreferencesBob';
  for (const uid of [alice, bob]) {
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
  }
  const initial = await identities.getPreferences(alice);
  assert.equal(initial.updatedAt, null);
  assert.equal(initial.preferences.privacy.profileVisibility, 'private');
  assert.equal(
    (await source.query('SELECT * FROM identity_preferences')).length,
    0
  );
  const update = {
    expectedRevision: initial.revision,
    preferences: defaultAccountPreferences(),
  };
  update.preferences.display.theme = 'dark';
  update.preferences.content.contentFilters.preferredTags = ['personal-topic'];
  await source.query(
    "CREATE TRIGGER fail_preferences_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected preferences outbox failure'"
  );
  try {
    await assert.rejects(
      identities.updatePreferences(alice, update, 'first-save')
    );
    assert.deepEqual(await identities.getPreferences(alice), initial);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM identity_account_commands WHERE identityId = ?',
          [alice]
        )
      ).length,
      0
    );
  } finally {
    await source.query('DROP TRIGGER fail_preferences_outbox');
  }
  let second = new DataSource(configuration);
  await second.initialize();
  try {
    let other = new MysqlCanonicalIdentities(second);
    const duplicates = await Promise.all([
      identities.updatePreferences(alice, update, 'first-save'),
      other.updatePreferences(alice, update, 'first-save'),
    ]);
    assert.deepEqual(duplicates, [
      { identityId: alice, revision: 2 },
      { identityId: alice, revision: 2 },
    ]);
    assert.equal(
      (await other.getPreferences(alice)).preferences.display.theme,
      'dark'
    );
    const competing = await Promise.allSettled([
      identities.updatePreferences(
        alice,
        { ...update, expectedRevision: 2 },
        'competing-a'
      ),
      other.updatePreferences(
        alice,
        {
          ...update,
          expectedRevision: 2,
          preferences: defaultAccountPreferences(),
        },
        'competing-b'
      ),
    ]);
    assert.equal(
      competing.filter((result) => result.status === 'fulfilled').length,
      1
    );
    assert.equal(
      competing.filter((result) => result.status === 'rejected').length,
      1
    );
    const saved = await other.getPreferences(alice);
    assert.equal(saved.revision, 3);
    assert.deepEqual(
      await identities.updatePreferences(alice, update, 'first-save'),
      duplicates[0]
    );
    assert.deepEqual(await identities.getPreferences(alice), saved);
    await assert.rejects(
      identities.updateProfile(
        alice,
        {
          expectedRevision: 1,
          name: 'Different command',
          bio: null,
          location: null,
          socialLinks: {},
        },
        'first-save'
      ),
      /another command/
    );
    await identities.updateProfile(
      alice,
      {
        expectedRevision: 3,
        name: 'Profile changed',
        bio: null,
        location: null,
        socialLinks: {},
      },
      'profile-save'
    );
    await assert.rejects(
      other.updatePreferences(
        alice,
        { ...update, expectedRevision: 3 },
        'stale-after-profile'
      ),
      /revision changed/
    );
    assert.equal((await other.getPreferences(bob)).updatedAt, null);
    const events = await source.query(
      'SELECT body FROM identity_events_outbox WHERE identityId = ?',
      [alice]
    );
    assert.equal(events.length, 4);
    assert.ok(
      events.every(
        (row) =>
          !row.body.includes('personal-topic') &&
          !row.body.includes('profileVisibility')
      )
    );
    const beforeReconnect = await identities.getPreferences(alice);
    await second.destroy();
    second = new DataSource(configuration);
    await second.initialize();
    other = new MysqlCanonicalIdentities(second);
    assert.deepEqual(await other.getPreferences(alice), beforeReconnect);
    const runner = source.createQueryRunner();
    try {
      await new AccountPreferences1791676806000().up(runner);
      await source.query(
        "UPDATE identity_preferences SET preferences = '{}' WHERE identityId = ?",
        [alice]
      );
      await assert.rejects(
        other.getPreferences(alice),
        /Invalid stored preferences/
      );
      await assert.rejects(new AccountPreferences1791676806000().up(runner));
      await source.query(
        'UPDATE identity_preferences SET preferences = ? WHERE identityId = ?',
        [JSON.stringify(beforeReconnect.preferences), alice]
      );
      await new AccountPreferences1791676806000().up(runner);
    } finally {
      await runner.release();
    }
    await identities.setSuspended(alice, true);
    await assert.rejects(other.getPreferences(alice));
    await assert.rejects(other.updatePreferences(alice, update, 'first-save'));
    await identities.setSuspended(alice, false);
    const beforeDelete = await identities.getPreferences(alice);
    await source.query(
      "CREATE TRIGGER fail_preferences_delete BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected deletion failure'"
    );
    try {
      await assert.rejects(identities.requestDeletion(alice));
      assert.deepEqual(await other.getPreferences(alice), beforeDelete);
    } finally {
      await source.query('DROP TRIGGER fail_preferences_delete');
    }
    await identities.requestDeletion(alice);
    assert.equal(
      (
        await source.query(
          'SELECT * FROM identity_preferences WHERE identityId = ?',
          [alice]
        )
      ).length,
      0
    );
    await assert.rejects(other.getPreferences(alice));
    await assert.rejects(other.updatePreferences(alice, update, 'first-save'));
    assert.equal((await other.getPreferences(bob)).updatedAt, null);
    console.log(
      'Account preferences SQL: atomic rollback, duplicate/concurrent writers, profile conflicts, reconnect, migration validation and lifecycle deletion pass.'
    );
  } finally {
    if (second.isInitialized) await second.destroy();
  }
}

async function qualifyAccountPreferencesHttp({
  accountOrigin,
  opaOrigin,
  headers,
  identities,
}) {
  const uid = 'PreferencesHttpAlice';
  const other = 'PreferencesHttpBob';
  for (const identityId of [uid, other])
    await identities.ensure({
      uid: identityId,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
  const call = (identityId = uid, method = 'GET', body) =>
    fetch(`${accountOrigin()}/api/me/preferences`, {
      method,
      headers: {
        ...headers(identityId),
        'Idempotency-Key': 'preferences-http-save',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
  const response = await call();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const initial = await response.json();
  assert.equal(initial.updatedAt, null);
  const input = {
    expectedRevision: initial.revision,
    preferences: defaultAccountPreferences(),
  };
  input.preferences.display.theme = 'dark';
  input.preferences.display.itemsPerPage = 50;
  const saved = await call(uid, 'PUT', input);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), {
    identityId: uid,
    revision: initial.revision + 1,
  });
  assert.equal((await call(uid, 'PUT', input)).status, 200);
  assert.equal(
    (await call(uid, 'PUT', { ...input, identityId: other })).status,
    400
  );
  assert.equal(
    (await call(uid, 'PUT', { ...input, preferences: {} })).status,
    400
  );
  assert.equal(
    (
      await call(uid, 'PUT', {
        ...input,
        preferences: defaultAccountPreferences(),
      })
    ).status,
    409
  );
  assert.equal((await (await call(other)).json()).updatedAt, null);
  assert.equal(
    (await fetch(`${accountOrigin()}/api/me/preferences`)).status,
    401
  );
  for (const actionName of [
    'identity.preferences.read',
    'identity.preferences.update',
  ]) {
    const decision = await fetch(
      `${opaOrigin}/v1/data/wapps/identity_admin/authz/allow`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: {
            identityId: uid,
            actionName,
            subject: { roles: ['admin'] },
            resource: { type: 'user', id: other },
          },
        }),
      }
    );
    assert.equal((await decision.json()).result, false);
  }
  return {
    async restored() {
      const response = await call();
      assert.equal(response.status, 200);
      const current = await response.json();
      assert.equal(current.preferences.display.theme, 'dark');
      assert.equal(current.preferences.display.itemsPerPage, 50);
      assert.equal(current.revision, initial.revision + 1);
    },
    async policyUnavailable() {
      assert.equal((await call()).status, 503);
      assert.equal((await call(uid, 'PUT', input)).status, 503);
      assert.equal(
        (await identities.getPreferences(uid)).revision,
        initial.revision + 1
      );
    },
  };
}

module.exports = { qualifyAccountPreferences, qualifyAccountPreferencesHttp };
