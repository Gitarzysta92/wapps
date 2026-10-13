/* Qualification mutates only a fresh random localhost database and emulator user. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const config = path.join(root, 'tsconfig.base.json');
require('ts-node').register({
  project: config,
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});
require('tsconfig-paths').register({
  baseUrl: root,
  paths: ts.readConfigFile(config, ts.sys.readFile).config.compilerOptions
    .paths,
});
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { createConnection } = require('mysql2/promise');
const {
  MysqlCanonicalIdentities,
  MysqlIdentityEvents,
  MysqlIdentityDeletions,
  IdentityEntity,
  CreateIdentities1788566400000,
  CanonicalIdentity1791676804000,
  PrivateProfile1791676805000,
  AccountPreferences1791676806000,
  AccountFavorites1791676807000,
  ProfileAvatars1791676828000,
  ProfileFollows1791676829000,
  ProfileContactEmail1791676830000,
  ProfileBadges1791676831000,
  AccountExports1791676832000,
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
  AccountErasureCoordination1791840002000,
  ProfileBadgeErasure1791840003000,
  AccountNotifications1791840016000,
  AccountFavoriteUpdates1791840019000,
} = require('../../sdk/features/identity/packages/infrastructure/mysql/src');
const {
  CompleteIdentityDeletion,
} = require('../../sdk/features/identity/libs/management/src');
const {
  DispatchIdentityEvents,
} = require('../../sdk/features/identity/libs/authentication/src');

test(
  'Canonical identity SQL migration, concurrent commands, rollback, delivery and reconnect qualification',
  {
    timeout:
      process.env.WAPPS_EMAIL_VERIFICATION_BROWSER === '1'
        ? 480_000
        : process.env.WAPPS_PROFILE_BROWSER === '1'
        ? 480_000
        : 60_000,
  },
  async () => {
    assert.equal(
      process.env.WAPPS_IDENTITY_INTEGRATION,
      '1',
      'Set WAPPS_IDENTITY_INTEGRATION=1 with local MySQL running; unavailable checks are not passes.'
    );
    const database = `identity_qualification_${randomUUID().replaceAll(
      '-',
      ''
    )}`;
    const options = {
      host: '127.0.0.1',
      port: Number(process.env.IDENTITY_TEST_MYSQL_PORT ?? 3306),
      user: process.env.IDENTITY_TEST_MYSQL_USERNAME ?? 'wapps',
      password:
        process.env.IDENTITY_TEST_MYSQL_PASSWORD ??
        process.env.LOCAL_PASSWORD ??
        'wapps-local-password',
      connectTimeout: 3000,
    };
    const connection = await createConnection(options);
    let source;
    let created = false;
    try {
      await connection.query(
        `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      );
      created = true;
      const configuration = {
        type: 'mysql',
        host: options.host,
        port: options.port,
        username: options.user,
        password: options.password,
        database,
        entities: [IdentityEntity],
        synchronize: false,
        migrations: [
          CreateIdentities1788566400000,
          CanonicalIdentity1791676804000,
          PrivateProfile1791676805000,
          AccountPreferences1791676806000,
          AccountFavorites1791676807000,
          ProfileAvatars1791676828000,
          ProfileFollows1791676829000,
          ProfileContactEmail1791676830000,
          ProfileBadges1791676831000,
          AccountExports1791676832000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
          AccountErasureCoordination1791840002000,
          ProfileBadgeErasure1791840003000,
          AccountNotifications1791840016000,
          AccountFavoriteUpdates1791840019000,
        ],
        migrationsTransactionMode: 'none',
      };
      source = await new DataSource(configuration).initialize();
      await source.runMigrations({ transaction: 'none' });
      const runner = source.createQueryRunner();
      try {
        await new CanonicalIdentity1791676804000().up(runner);
      } finally {
        await runner.release();
      }
      let identities = new MysqlCanonicalIdentities(source);
      if (process.env.WAPPS_ACCOUNT_ERASURE_CLEANUP === '1') {
        await require('./account-erasure-cleanup-checks.cjs')(source);
        return;
      }
      if (process.env.WAPPS_ACCOUNT_ERASURE_COORDINATOR === '1') {
        await require('./account-erasure-coordinator-checks.cjs')(source);
        return;
      }
      if (process.env.WAPPS_IDENTITY_WRITE_BARRIERS === '1') {
        await require('./identity-write-barrier-checks.cjs')(source);
        return;
      }
      if (process.env.WAPPS_ACCOUNT_EXPORT_STORAGE === '1') {
        await require('./account-export-source-checks.cjs').qualifyAccountExportSource(
          { source, configuration, identities }
        );
        await require('./account-export-storage-checks.cjs').qualifyAccountExportStorage(
          { source, configuration, identities }
        );
        return;
      }
      const provision = () =>
        identities.ensure({
          uid: 'QualificationUid',
          kind: 'user',
          provider: 'email',
          activate: true,
        });
      const concurrent = await Promise.all([provision(), provision()]);
      assert.equal(concurrent.filter((value) => value.created).length, 1);
      assert.equal(
        concurrent[0].state.subjectId,
        concurrent[1].state.subjectId
      );
      assert.equal(
        await identities.find('qualificationuid'),
        null,
        'Canonical UIDs must remain case-sensitive even with a database default collation'
      );

      const profile = {
        name: 'Qualified User',
        bio: null,
        location: null,
        avatarUri: null,
        expectedRevision: 1,
      };
      await source.query(
        "CREATE TRIGGER fail_identity_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected outbox failure'"
      );
      await assert.rejects(
        identities.enrollAccount(
          'QualificationUid',
          profile.name,
          'enrollment-1'
        )
      );
      await assert.rejects(
        identities.completeRegistration(
          'QualificationUid',
          profile,
          'registration-1'
        )
      );
      assert.equal(
        (await identities.account('QualificationUid')).status,
        'STUB'
      );
      assert.equal((await identities.find('QualificationUid')).revision, 1);
      assert.equal(
        Number(
          (
            await source.query(
              'SELECT COUNT(*) AS count FROM identity_account_commands'
            )
          )[0].count
        ),
        0
      );
      await source.query('DROP TRIGGER fail_identity_outbox');
      const registrations = await Promise.all([
        identities.enrollAccount(
          'QualificationUid',
          profile.name,
          'enrollment-1'
        ),
        identities.enrollAccount(
          'QualificationUid',
          profile.name,
          'enrollment-1'
        ),
      ]);
      assert.deepEqual(registrations[0], registrations[1]);
      assert.equal(registrations[0].revision, 2);
      await assert.rejects(
        identities.enrollAccount(
          'QualificationUid',
          'Different',
          'enrollment-1'
        )
      );
      await assert.rejects(
        identities.enrollAccount(
          'QualificationUid',
          profile.name,
          'different-key'
        )
      );
      await identities.updateProfile(
        'QualificationUid',
        {
          name: 'Edited User',
          bio: null,
          location: null,
          socialLinks: {},
          expectedRevision: 2,
        },
        'profile-edit'
      );
      assert.equal(
        (
          await identities.enrollAccount(
            'QualificationUid',
            profile.name,
            'enrollment-1'
          )
        ).revision,
        2
      );
      assert.equal(
        (await identities.account('QualificationUid')).profile.name,
        'Edited User'
      );
      await assert.rejects(
        identities.completeRegistration(
          'QualificationUid',
          profile,
          'stale-command'
        )
      );
      await assert.rejects(
        identities.completeRegistration(
          'QualificationUid',
          { ...profile, name: 'Different' },
          'registration-1'
        )
      );
      await identities.setSuspended('QualificationUid', true);
      assert.equal((await provision()).state.isSuspended, true);
      await assert.rejects(
        identities.recordAuthentication('QualificationUid', 'email')
      );
      await identities.setSuspended('QualificationUid', false);

      // Isolate a single retained event for lease/fencing and confirm/mark crash checks.
      await source.query('DELETE FROM identity_events_outbox');
      await identities.recordAuthentication('QualificationUid', 'email');
      let events = new MysqlIdentityEvents(source);
      const at = Date.now();
      const leases = await Promise.all([
        events.claim(at, 'lease-a'),
        events.claim(at, 'lease-b'),
      ]);
      assert.equal(leases.filter(Boolean).length, 1);
      const leased = leases.find(Boolean);
      const replacement = await events.claim(at + 31000, 'replacement');
      assert.equal(replacement.id, leased.id);
      assert.equal(
        await events.delivered(
          leased.id,
          leases[0] ? 'lease-a' : 'lease-b',
          at + 31001
        ),
        false
      );
      await events.failed(leased.id, 'replacement', 0, at, null);
      const deliveries = [];
      const failingMark = {
        claim: events.claim.bind(events),
        failed: events.failed.bind(events),
        delivered: async () => {
          throw new Error('injected disconnect after confirm');
        },
      };
      const first = new DispatchIdentityEvents(
        failingMark,
        {
          publish: async (body) => {
            deliveries.push(body);
          },
        },
        randomUUID,
        () => at + 32000
      );
      assert.equal(await first.once(), 'retry');
      const replay = new DispatchIdentityEvents(
        events,
        {
          publish: async (body) => {
            deliveries.push(body);
          },
        },
        randomUUID,
        () => at + 40000
      );
      assert.equal(await replay.once(), 'delivered');
      assert.equal(deliveries.length, 2);
      assert.equal(deliveries[0], deliveries[1]);

      const tombstone = await identities.requestDeletion('QualificationUid');
      assert.equal(tombstone.isActive, false);
      assert.equal(tombstone.isDeleted, true);
      assert.equal(
        Number(
          (
            await source.query(
              'SELECT COUNT(*) AS count FROM identity_accounts'
            )
          )[0].count
        ),
        0
      );
      assert.equal(
        (await identities.requestDeletion('QualificationUid')).revision,
        tombstone.revision
      );
      await assert.rejects(
        identities.completeRegistration(
          'QualificationUid',
          profile,
          'registration-1'
        )
      );
      await assert.rejects(identities.setSuspended('QualificationUid', false));
      let removals = 0;
      const jobs = new MysqlIdentityDeletions(source);
      const credentials = {
        remove: async () => {
          removals++;
        },
      };
      const crash = new CompleteIdentityDeletion(
        {
          claim: jobs.claim.bind(jobs),
          failed: jobs.failed.bind(jobs),
          complete: async () => {
            throw new Error('after remote removal');
          },
        },
        credentials,
        randomUUID
      );
      assert.equal(await crash.once(), 'retry');
      const cleanup = new CompleteIdentityDeletion(
        jobs,
        credentials,
        randomUUID,
        () => Date.now() + 5000
      );
      assert.equal(await cleanup.once(), 'completed');
      assert.equal(removals, 2);

      await source.destroy();
      source = await new DataSource(configuration).initialize();
      identities = new MysqlCanonicalIdentities(source);
      events = new MysqlIdentityEvents(source);
      assert.equal((await identities.find('QualificationUid')).isDeleted, true);
      assert.equal(
        await new CompleteIdentityDeletion(
          new MysqlIdentityDeletions(source),
          credentials,
          randomUUID
        ).once(),
        'idle'
      );
      assert.equal(
        (await events.claim(Date.now(), randomUUID())).eventType,
        'identity.deleted'
      );

      // Separate SQL sessions must see one canonical profile and serialize concurrent edits.
      await identities.ensure({
        uid: 'ProfileAlice',
        kind: 'user',
        provider: 'email',
        activate: true,
      });
      await identities.ensure({
        uid: 'ProfileBob',
        kind: 'user',
        provider: 'github',
        activate: true,
      });
      await identities.completeRegistration(
        'ProfileAlice',
        { ...profile, avatarUri: 'https://example.test/alice.png' },
        'initial-profile'
      );
      const original = await identities.getProfile('ProfileAlice');
      const edit = {
        expectedRevision: 2,
        name: 'Alice edited',
        bio: 'Durable bio',
        location: 'Warsaw',
        socialLinks: { website: 'https://example.test', github: '@alice' },
      };
      await source.query(
        "CREATE TRIGGER fail_profile_outbox BEFORE INSERT ON identity_events_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected profile outbox failure'"
      );
      await assert.rejects(
        identities.updateProfile('ProfileAlice', edit, 'edit-profile')
      );
      assert.deepEqual(await identities.getProfile('ProfileAlice'), original);
      assert.equal(
        (
          await source.query(
            "SELECT commandKey FROM identity_account_commands WHERE identityId = 'ProfileAlice' AND commandKey = 'edit-profile'"
          )
        ).length,
        0
      );
      await source.query('DROP TRIGGER fail_profile_outbox');
      const otherSource = await new DataSource(configuration).initialize();
      let saved;
      try {
        const other = new MysqlCanonicalIdentities(otherSource);
        const edits = await Promise.allSettled([
          identities.updateProfile('ProfileAlice', edit, 'edit-profile'),
          other.updateProfile(
            'ProfileAlice',
            { ...edit, name: 'Concurrent edit' },
            'other-edit'
          ),
        ]);
        assert.equal(
          edits.filter((item) => item.status === 'fulfilled').length,
          1
        );
        assert.equal(
          edits.filter((item) => item.status === 'rejected').length,
          1
        );
        saved = await other.getProfile('ProfileAlice');
        assert.equal(saved.revision, 3);
        assert.equal(saved.profile.avatarUri, original.profile.avatarUri);
        assert.equal(saved.registeredAt, original.registeredAt);
        assert.deepEqual(saved.profile.socialLinks, {
          github: '@alice',
          website: 'https://example.test',
        });
        const nextEdit = {
          ...edit,
          expectedRevision: 3,
          name: 'Final profile',
        };
        const duplicates = await Promise.all([
          identities.updateProfile('ProfileAlice', nextEdit, 'final-edit'),
          other.updateProfile('ProfileAlice', nextEdit, 'final-edit'),
        ]);
        assert.deepEqual(duplicates[0], duplicates[1]);
        assert.equal(duplicates[0].revision, 4);
        await assert.rejects(
          identities.completeRegistration(
            'ProfileAlice',
            { ...profile, expectedRevision: 4 },
            'registration-overwrite'
          )
        );
        await identities.updateProfile(
          'ProfileBob',
          { ...edit, name: 'Bob', expectedRevision: 1, socialLinks: {} },
          'bob-profile'
        );
        assert.equal(
          (await other.getProfile('ProfileBob')).profile.name,
          'Bob'
        );
        assert.equal(
          (await other.getProfile('ProfileAlice')).profile.name,
          'Final profile'
        );
        const outbox = await source.query(
          "SELECT revision, body FROM identity_events_outbox WHERE identityId = 'ProfileAlice' AND eventType = 'identity.updated' ORDER BY revision"
        );
        assert.deepEqual(
          outbox.map((item) => Number(item.revision)),
          [2, 3, 4]
        );
        assert.ok(outbox.every((item) => !item.body.includes('Durable bio')));
      } finally {
        await otherSource.destroy();
      }
      await source.destroy();
      source = await new DataSource(configuration).initialize();
      identities = new MysqlCanonicalIdentities(source);
      assert.equal(
        (await identities.getProfile('ProfileAlice')).profile.name,
        'Final profile'
      );
      assert.equal((await identities.getProfile('ProfileAlice')).revision, 4);
      const profileRunner = source.createQueryRunner();
      try {
        await new PrivateProfile1791676805000().up(profileRunner);
      } finally {
        await profileRunner.release();
      }
      await identities.requestDeletion('ProfileAlice');
      await assert.rejects(identities.getProfile('ProfileAlice'));
      await assert.rejects(
        identities.updateProfile(
          'ProfileAlice',
          { ...edit, expectedRevision: 3, name: 'Final profile' },
          'final-edit'
        )
      );
      assert.equal(
        (await identities.getProfile('ProfileBob')).profile.name,
        'Bob'
      );

      await require('./account-preferences-qualification.cjs').qualifyAccountPreferences(
        { source, configuration, identities }
      );
      await require('./account-favorites-qualification.cjs').qualifyAccountFavorites(
        { source, configuration, identities }
      );

      await require('./profile-avatars-sql.cjs').qualifyProfileAvatars({
        source,
        configuration,
        identities,
      });
      await require('./public-profiles-sql.cjs').qualifyPublicProfilesSql({
        source,
        configuration,
        identities,
      });
      await require('./profile-contact-sql.cjs').qualifyProfileContact({
        source,
        configuration,
        identities,
      });
      await require('./profile-badges-sql.cjs').qualifyProfileBadges({
        source,
        configuration,
        identities,
      });
      if (process.env.WAPPS_PROFILE_BROWSER === '1') {
        const {
          privateProfileJourney,
        } = require('./private-profile-journey.cjs');
        await privateProfileJourney({
          root,
          source,
          identities,
          configuration,
        });
      }
      if (process.env.WAPPS_EMAIL_VERIFICATION_BROWSER === '1') {
        await require('./email-verification-journey.cjs').emailVerificationJourney(
          { root, source, identities, configuration }
        );
      }

      await source.query(
        'CREATE TABLE identity_subjects (id int PRIMARY KEY) ENGINE=InnoDB'
      );
      await source.query('INSERT INTO identity_subjects VALUES (1)');
      const legacyRunner = source.createQueryRunner();
      try {
        await assert.rejects(
          new CanonicalIdentity1791676804000().up(legacyRunner),
          /verified/
        );
      } finally {
        await legacyRunner.release();
      }
    } finally {
      if (source?.isInitialized) await source.destroy();
      if (created) await connection.query(`DROP DATABASE \`${database}\``);
      await connection.end();
    }
  }
);
