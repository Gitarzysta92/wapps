const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function discussionFavoritesChecks(options) {
  const {
    application,
    discussion,
    accepted,
    waitThread,
    root,
    source,
    sql,
    reader,
    projections,
    pass,
  } = options;
  const {
    EditorialCommands,
  } = require('../../apps/services/editorial/src/app/application/editorial-commands');
  const {
    MysqlEditorialWrites,
  } = require('../../apps/services/editorial/src/app/infrastructure/mysql-editorial-writes');
  const {
    projectEditorialSnapshot,
  } = require('../../apps/services/editorial/src/app/application/editorial-materialization');
  const editorial = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    options.policy,
    { generate: randomUUID }
  );
  const publisher = {
    identityId: 'DiscussionFavoritesPublisher',
    tenantId: 'default',
    roles: ['editorial:publisher'],
  };
  const author = {
    identityId: 'DraftBrowserAlice',
    tenantId: 'default',
    roles: [],
  };
  const base = `application-discussions/${application.id}`;
  const content = {
    title: 'A saved community topic',
    displayName: 'Public Alice',
    text: 'A topic worth keeping.',
    tags: [],
  };
  const topic = accepted(await discussion('POST', base, content, author), 201);
  await waitThread(application.id, topic.id, 1);
  const reply = accepted(
    await discussion(
      'POST',
      `${base}/${topic.id}/replies`,
      { displayName: 'Public Alice', text: 'A reply is not a favorite topic.' },
      author
    ),
    201
  );
  await waitThread(application.id, topic.id, 2);
  const select = (ids) =>
    discussion(
      'GET',
      'discussion-selection?ids=' + ids.join(','),
      undefined,
      null
    );
  const selected = accepted(await select([topic.id, reply.id, randomUUID()]));
  assert.deepEqual(selected.items, [
    {
      id: topic.id,
      applicationId: application.id,
      revision: 2,
      title: content.title,
      replyCount: 1,
    },
  ]);
  assert.ok(!JSON.stringify(selected).includes(author.identityId));
  const response = await fetch(
    options.discussionOrigin() + '/api/discussion-selection?ids=' + topic.id
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  for (const query of [
    `ids=${topic.id}&tenantId=other`,
    `ids=${topic.id}&applicationId=${application.id}`,
    `ids=${topic.id},${topic.id}`,
    'ids=sample-topic',
    'ids=' + Array(51).fill(topic.id).join(','),
  ])
    assert.equal(
      (
        await discussion(
          'GET',
          'discussion-selection?' + query,
          undefined,
          null
        )
      ).status,
      400
    );
  for (const [field, value, original] of [
    ['tenantId', 'other', 'default'],
    ['subjectKind', 'article', 'application'],
    ['subjectKind', null, 'application'],
  ]) {
    await options.discussionSource.query(
      `UPDATE discussion_write_aggregates SET ${field} = ? WHERE id = ?`,
      [value, topic.id]
    );
    try {
      assert.deepEqual(accepted(await select([topic.id])).items, []);
    } finally {
      await options.discussionSource.query(
        `UPDATE discussion_write_aggregates SET ${field} = ? WHERE id = ?`,
        [original, topic.id]
      );
    }
  }
  pass(
    'Discussion favorites: bounded public selection resolves only live application roots in the public tenant, rejects injected scope and omits reply/article/generic targets without exposing private identities'
  );

  await require('./account-favorites-journey.cjs').accountFavoritesJourney({
    root,
    sql,
    editorialOrigin: options.origin(),
    discussionOrigin: options.discussionServiceOrigin(),
    catalogOrigin: options.origin(),
    ingressSecret: options.headers('ProfileReader')['x-ingress-auth'],
    createTarget: (slug) =>
      editorial.create(
        'app',
        {
          name: slug,
          slug,
          website: 'https://example.test',
          description: 'Favorites regression target.',
        },
        publisher,
        randomUUID()
      ),
    renameTarget: (id, slug) =>
      editorial.update(
        'app',
        id,
        { slug, expectedRevision: 1 },
        publisher,
        randomUUID()
      ),
    deleteTarget: (id, expectedRevision) =>
      editorial.remove(
        'app',
        id,
        { expectedRevision },
        publisher,
        randomUUID()
      ),
    publishTarget: async (id) =>
      projections.publish(
        projectEditorialSnapshot(await reader.read('app', id))
      ),
    hiddenTarget: randomUUID(),
    browser: false,
    additionalQualification: async ({
      accountOrigin,
      headers,
      identities,
      favorites,
      source: identitySource,
      restartAccount,
    }) => {
      if (process.env.WAPPS_PUBLIC_PROFILE_ACTIVITY === '1') {
        await require('./public-profile-activity-checks.cjs').publicProfileActivityChecks(
          {
            ...options,
            accountOrigin,
            accountHeaders: headers,
            identities,
            identitySource,
            restartAccount,
          }
        );
      }
      if (process.env.WAPPS_PUBLIC_PROFILE_DISCUSSIONS === '1') {
        await require('./public-profile-discussions-checks.cjs').publicProfileDiscussionsChecks(
          {
            ...options,
            accountOrigin,
            accountHeaders: headers,
            identities,
            identitySource,
            restartAccount,
          }
        );
      }
      if (process.env.WAPPS_PUBLIC_PROFILE_SUITES === '1') {
        await require('./public-profile-suites-checks.cjs').publicProfileSuitesChecks(
          {
            ...options,
            accountOrigin,
            accountHeaders: headers,
            identities,
            identitySource,
            restartAccount,
          }
        );
      }
      if (process.env.WAPPS_PUBLIC_PROFILE_FAVORITES === '1') {
        await require('./public-profile-favorites-checks.cjs').publicProfileFavoritesChecks(
          {
            ...options,
            topic,
            accountOrigin,
            accountHeaders: headers,
            identities,
            favorites,
            identitySource,
            restartAccount,
          }
        );
      }
      const alice = 'FavoriteDiscussionAlice',
        bob = 'FavoriteDiscussionBob',
        carol = 'FavoriteDiscussionCarol';
      for (const uid of [
        alice,
        bob,
        carol,
        'DraftBrowserAlice',
        'DraftBrowserBob',
      ])
        await identities.ensure({
          uid,
          kind: 'user',
          provider: 'email',
          activate: true,
        });
      async function account(uid, body, key = randomUUID()) {
        const response = await fetch(accountOrigin() + '/api/me/favorites', {
          method: body ? 'PUT' : 'GET',
          headers: { ...headers(uid), 'idempotency-key': key },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(10000),
        });
        return { status: response.status, body: await response.json() };
      }
      const save = {
        expectedRevision: 1,
        target: { kind: 'discussions', id: topic.id },
        saved: true,
      };
      const receipt = accepted(await account(alice, save, 'saved-topic'));
      accepted(await account(bob, save));
      assert.deepEqual(
        accepted(await account(alice, save, 'saved-topic')),
        receipt
      );
      assert.equal((await account(alice, save)).status, 409);
      for (const id of [reply.id, randomUUID()])
        assert.equal(
          (
            await account(carol, {
              ...save,
              target: { kind: 'discussions', id },
            })
          ).status,
          400
        );
      assert.deepEqual(accepted(await account(carol)).favorites, []);
      await restartAccount();
      assert.equal(accepted(await account(alice)).favorites[0].id, topic.id);
      pass(
        'Discussion favorites: canonical account saves survive restart, exact replay deduplicates, competing revisions conflict, and invalid targets leave account state unchanged'
      );

      await options.stopWorker();
      const edit = accepted(
        await discussion(
          'PUT',
          `${base}/${topic.id}`,
          {
            expectedRevision: 2,
            content: { ...content, title: 'Updated saved topic' },
          },
          author
        )
      );
      assert.equal((await select([topic.id])).status, 503);
      assert.equal((await account(carol, save)).status, 503);
      assert.deepEqual(accepted(await account(carol)).favorites, []);
      await restartAccount(undefined, 'http://127.0.0.1:1');
      assert.deepEqual(
        accepted(await account(alice, save, 'saved-topic')),
        receipt
      );
      assert.equal((await account(carol, save)).status, 503);
      accepted(
        await account(alice, { ...save, expectedRevision: 2, saved: false })
      );
      assert.deepEqual(accepted(await account(alice)).favorites, []);
      options.startWorker();
      await waitThread(application.id, topic.id, edit.revision);
      await restartAccount(undefined, options.discussionServiceOrigin());
      assert.equal(
        accepted(await select([topic.id])).items[0].title,
        'Updated saved topic'
      );
      pass(
        'Discussion favorites: projection lag and owning-service outage never fabricate metadata or eligibility; historical receipts and removals remain available independently'
      );

      await options.withdraw();
      assert.deepEqual(accepted(await select([topic.id])).items, []);
      assert.equal((await account(carol, save)).status, 400);
      assert.equal(accepted(await account(bob)).favorites[0].id, topic.id);
      await options.republish();
      assert.equal(accepted(await select([topic.id])).items.length, 1);
      accepted(
        await discussion(
          'DELETE',
          `${base}/${topic.id}`,
          { expectedRevision: edit.revision },
          author
        )
      );
      assert.deepEqual(accepted(await select([topic.id])).items, []);
      accepted(
        await account(bob, { ...save, expectedRevision: 2, saved: false })
      );
      assert.deepEqual(accepted(await account(bob)).favorites, []);
      pass(
        'Discussion favorites: parent withdrawal and topic deletion immediately revoke target visibility while retained saved references remain removable; republication restores eligible targets'
      );

      await require('./discussion-favorites-browser.cjs').discussionFavoritesBrowser(
        {
          ...options,
          accountOrigin,
          accountHeaders: headers,
          favorites,
          restart: async () => {
            await options.restart();
            await restartAccount(undefined, options.discussionServiceOrigin());
          },
        }
      );
    },
  });
}

module.exports = { discussionFavoritesChecks };
