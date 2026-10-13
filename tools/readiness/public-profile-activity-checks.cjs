const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const http = require('node:http');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function publicProfileActivityChecks(options) {
  const { identities, accountOrigin, accountHeaders, pass } = options;
  const owner = 'ProfileActivityOwner',
    follower = 'ProfileActivityFollower';
  for (const uid of [owner, follower]) {
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    await identities.enrollAccount(uid, uid, randomUUID());
  }
  const ownerId = (await identities.find(owner)).subjectId;
  const secret = accountHeaders(owner)['x-ingress-auth'];
  const anonymous = { 'x-ingress-auth': secret, 'x-anonymous': 'true' };
  const actor = (uid = owner, roles = []) => ({
    identityId: uid,
    tenantId: 'default',
    roles,
  });
  const accepted = async (response) => {
    assert.ok(
      response.ok,
      `${response.url}: ${response.status} ${await response.clone().text()}`
    );
    return response.json();
  };
  const account = (uid, route, method = 'GET', body) =>
    fetch(accountOrigin() + '/api/' + route, {
      method,
      headers: {
        ...(uid ? accountHeaders(uid) : anonymous),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
  const route = `profiles/${ownerId}/activity`;
  const read = (uid = null, after) =>
    account(
      uid,
      route + (after ? '?after=' + encodeURIComponent(after) : '')
    ).then(accepted);
  const privacy = async (
    profileVisibility,
    showActivityHistory,
    categories = {}
  ) => {
    const current = await identities.getPreferences(owner);
    Object.assign(
      current.preferences.privacy,
      {
        profileVisibility,
        showActivityHistory,
        showSuites: true,
        showDiscussions: true,
        showFavorites: true,
      },
      categories
    );
    await accepted(
      await account(owner, 'me/preferences', 'PUT', {
        expectedRevision: current.revision,
        preferences: current.preferences,
      })
    );
  };
  const editorial = (method, path, body, review = false) =>
    fetch(options.origin() + '/api/' + path, {
      method,
      headers: {
        ...options.headers(
          review ? 'ActivityReviewer' : owner,
          'default',
          review ? ['editorial:reviewer'] : []
        ),
        'idempotency-key': randomUUID(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    }).then(accepted);
  const publish = async (kind, workspace, id) => {
    let current = await editorial('GET', `me/${workspace}/${id}/publication`);
    await editorial('POST', `me/${workspace}/${id}/submit`, {
      expectedRevision: current.revision,
      ...(['suite', 'application'].includes(kind)
        ? {}
        : { expectedPublicationRevision: current.publicationRevision }),
    });
    current = await editorial('GET', `me/${workspace}/${id}/publication`);
    await editorial(
      'POST',
      `editorial/${kind}-reviews/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: current.revision,
        submittedRevision: current.latestSubmission.submittedRevision,
        ...(kind === 'suite'
          ? {}
          : kind === 'application'
          ? { reason: '' }
          : {
              expectedPublicationRevision: current.publicationRevision,
              reason: '',
            }),
      },
      true
    );
    const publicId =
      kind === 'release'
        ? (await editorial('GET', `me/releases/${id}`)).target.releaseId
        : kind === 'application'
        ? current.editing?.applicationId ?? id
        : id;
    await options.projections.publish(
      projectEditorialSnapshot(
        await options.reader.read(
          kind === 'application' ? 'app' : kind,
          publicId
        )
      )
    );
    return publicId;
  };
  const withdraw = async (kind, workspace, id) => {
    const current = await editorial('GET', `me/${workspace}/${id}/publication`);
    await editorial('POST', `me/${workspace}/${id}/withdraw`, {
      expectedRevision: current.revision,
      ...(['suite', 'application'].includes(kind)
        ? {}
        : { expectedPublicationRevision: current.publicationRevision }),
    });
  };
  await privacy('public', false);
  assert.deepEqual(await read(), { sharing: 'hidden', items: [], after: null });
  await privacy('public', true);
  assert.deepEqual(await read(), {
    sharing: 'visible',
    items: [],
    after: null,
  });
  const application = await editorial('POST', 'me/application-drafts', {
    name: 'Profile activity application',
    slug: 'profile-activity-app',
    website: 'https://profile-activity.example.test',
    description: 'Reviewed application for public activity.',
  });
  await publish('application', 'application-drafts', application.id);
  const originalDraft = await editorial(
    'GET',
    `me/application-drafts/${application.id}`
  );
  await editorial('PUT', `me/application-drafts/${application.id}`, {
    expectedRevision: originalDraft.revision,
    name: originalDraft.name,
    slug: 'private-original-activity-draft',
    website: originalDraft.website,
    description: originalDraft.description,
  });
  const suite = await editorial('POST', 'me/suites', {
    title: 'Profile activity suite',
    description: 'A reviewed activity collection.',
    applicationIds: [application.id],
  });
  await publish('suite', 'suites', suite.id);
  const articleFields = {
    title: 'Profile activity article',
    slug: 'profile-activity-article',
    excerpt: 'A reviewed public article.',
    byline: 'Public author',
    category: 'Guides',
    tags: [],
    sections: [
      { heading: 'Activity', paragraphs: ['This is published content.'] },
    ],
  };
  const article = await editorial('POST', 'me/articles', articleFields);
  await publish('article', 'articles', article.id);
  if (process.env.WAPPS_PROFILE_ARTICLES_ONLY === '1') {
    await require('./profile-articles-checks.cjs').profileArticlesChecks({
      ...options,
      owner,
      follower,
      ownerId,
      account,
      accepted,
      privacy,
      editorial,
      publish,
      withdraw,
      article,
      articleFields,
    });
    return;
  }
  const {
    ApplicationOwnership,
  } = require('../../apps/services/editorial/src/app/application-ownership/application-ownership');
  const {
    MysqlApplicationOwnership,
  } = require('../../apps/services/editorial/src/app/application-ownership/mysql-application-ownership');
  // This slice qualifies consumption of an approved grant; DNS itself has separate evidence.
  const ownership = new ApplicationOwnership(
    new MysqlApplicationOwnership(options.source),
    { matches: async () => true },
    options.policy,
    { id: randomUUID, token: () => randomBytes(32).toString('hex') }
  );
  const claim = await ownership.create(
    actor(),
    {
      applicationId: application.id,
      evidenceUrl: 'https://profile-activity.example.test/team',
      notes: 'I maintain the official application website.',
    },
    randomUUID()
  );
  const proof = await ownership.change(
    actor(),
    claim.id,
    'verify',
    { expectedRevision: claim.revision },
    randomUUID()
  );
  await ownership.change(
    actor('IndependentActivityStaff', ['editorial:ownership-reviewer']),
    claim.id,
    'approve',
    { expectedRevision: proof.revision },
    randomUUID()
  );
  await options.projections.publish(
    projectEditorialSnapshot(await options.reader.read('app', application.id))
  );
  const canonical = await editorial(
    'GET',
    `me/application-drafts/canonical/${application.id}`
  );
  const ownedDraft = await editorial(
    'POST',
    'me/application-drafts/from-application',
    {
      editing: {
        applicationId: application.id,
        claimId: claim.id,
        sourcePublicationRevision: canonical.sourcePublicationRevision,
      },
      fields: canonical.fields,
    }
  );
  await publish('application', 'application-drafts', ownedDraft.id);
  const release = await editorial('POST', 'me/releases', {
    applicationId: application.id,
    claimId: claim.id,
    fields: {
      version: '2026.10+activity',
      channel: 'stable',
      type: 'major',
      releasedOn: '2026-10-12',
      title: 'Profile activity release',
      description: 'Reviewed release notes.',
      changes: [
        { type: 'feature', description: 'Publish current public activity.' },
      ],
    },
  });
  await publish('release', 'releases', release.id);
  const base = (target) =>
    `${
      target.kind === 'article' ? 'article-comments' : 'application-discussions'
    }/${target.id}`;
  const appTarget = { kind: 'application', id: application.id },
    articleTarget = { kind: 'article', id: article.id };
  async function wait(target, id, revision) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await options.discussion(
        'GET',
        `${base(target)}/${id}`,
        undefined,
        null
      );
      if (response.status === 200 && response.body.revision === revision)
        return response.body;
      assert.ok([200, 503].includes(response.status), JSON.stringify(response));
      await delay(100);
    }
    throw new Error('Activity discussion generation did not converge');
  }
  async function create(target, title) {
    const receipt = options.accepted(
      await options.discussion(
        'POST',
        base(target),
        {
          displayName: 'Public member',
          text: title,
          ...(target.kind === 'application' ? { title, tags: [] } : {}),
        },
        actor()
      ),
      201
    );
    await wait(target, receipt.id, receipt.revision);
    return { ...receipt, target };
  }
  async function reply(root) {
    const receipt = options.accepted(
      await options.discussion(
        'POST',
        `${base(root.target)}/${root.id}/replies`,
        { displayName: 'Public member', text: 'Current public reply' },
        actor()
      ),
      201
    );
    root.revision = receipt.revision;
    await wait(root.target, root.id, root.revision);
    return receipt;
  }
  const topic = await create(appTarget, 'Profile activity discussion');
  const topicReply = await reply(topic);
  const comment = await create(
    articleTarget,
    'Profile activity article comment'
  );
  await reply(comment);
  const reviewBase = `application-reviews/${application.id}`;
  const review = options.accepted(
    await options.discussion(
      'PUT',
      reviewBase + '/mine',
      {
        expectedRevision: 0,
        content: {
          displayName: 'Public member',
          rating: 4,
          text: 'A real published review.',
        },
      },
      actor()
    )
  );
  for (const target of [
    { kind: 'applications', id: application.id },
    { kind: 'suites', id: suite.id },
    { kind: 'discussions', id: topic.id },
    { kind: 'articles', id: article.id },
  ]) {
    const current = await identities.getPreferences(owner);
    await accepted(
      await account(owner, 'me/favorites', 'PUT', {
        expectedRevision: current.revision,
        target,
        saved: true,
      })
    );
  }
  if (process.env.WAPPS_PROFILE_TOTALS_ONLY === '1') {
    await require('./profile-totals-checks.cjs').profileTotalsChecks({
      ...options,
      discussionAccepted: options.accepted,
      owner,
      follower,
      ownerId,
      account,
      accepted,
      privacy,
      editorial,
      publish,
      withdraw,
      suite,
      article,
      articleFields,
      application,
      ownedDraft,
      appTarget,
      topic,
      create,
      reply,
      actor,
      base,
      wait,
    });
    return;
  }
  async function all() {
    const items = [];
    let after = null;
    for (let page = 0; page < 30; page++) {
      const response = await read(null, after);
      items.push(...response.items);
      after = response.after;
      if (!after) return items;
    }
    throw new Error('Activity continuation did not terminate');
  }
  const items = await all();
  assert.equal(items.length, 13);
  assert.equal(
    new Set(items.map((item) => `${item.kind}:${item.id}`)).size,
    13
  );
  for (const kind of [
    'application',
    'suite',
    'article',
    'release',
    'discussion',
    'reply',
    'comment',
    'review',
    'favorite-application',
    'favorite-suite',
    'favorite-article',
    'favorite-discussion',
  ])
    assert.ok(
      items.some((item) => item.kind === kind),
      kind
    );
  assert.ok(!JSON.stringify(items).includes(owner));
  const replyActivity = items.find((item) => item.id === topicReply.id);
  assert.equal(replyActivity.target.id, topic.id);
  const second = (await read()).after;
  const secondItems = (await read(null, second)).items;
  await options.restartAccount();
  assert.deepEqual((await read(null, second)).items, secondItems);
  const forged =
    second.slice(0, 20) + (second[20] === 'a' ? 'b' : 'a') + second.slice(21);
  assert.equal((await account(null, route + '?after=' + forged)).status, 400);
  pass(
    'profile activity: real approved applications/suites/articles/releases, individual topics/replies/comments, reviews and four favorite types merge chronologically without duplicates; encrypted continuation survives account restart'
  );

  const privateArticle = await editorial('GET', `me/articles/${article.id}`);
  await editorial('PUT', `me/articles/${article.id}`, {
    expectedRevision: privateArticle.revision,
    ...articleFields,
    title: 'Unreviewed private activity title',
  });
  assert.deepEqual(await all(), items);
  for (const [setting, excluded] of [
    ['showSuites', ['suite', 'favorite-suite']],
    [
      'showDiscussions',
      ['discussion', 'reply', 'comment', 'favorite-discussion'],
    ],
    [
      'showFavorites',
      [
        'favorite-application',
        'favorite-suite',
        'favorite-article',
        'favorite-discussion',
      ],
    ],
  ]) {
    await privacy('public', true, { [setting]: false });
    assert.ok((await all()).every((item) => !excluded.includes(item.kind)));
  }
  await privacy('public', false);
  assert.deepEqual(await read(owner), {
    sharing: 'hidden',
    items: [],
    after: null,
  });
  await privacy('private', true);
  assert.equal((await account(null, route)).status, 404);
  assert.equal((await account(follower, route)).status, 404);
  assert.equal((await read(owner)).items.length, 10);
  await privacy('public', true);
  const internalBody = {
    ownerIdentityId: owner,
    after: null,
    sharing: { suites: true, discussions: true, favorites: true },
  };
  for (const origin of [options.origin(), options.discussionOrigin()]) {
    for (const headers of [
      {},
      { 'x-profile-reader': 'wrong' },
      { 'x-profile-reader': secret, authorization: 'Bearer token' },
      { 'x-profile-reader': secret, 'x-user-id': owner },
    ]) {
      const result = await fetch(origin + '/api/internal/profile-activity', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(internalBody),
      });
      assert.ok([401, 403].includes(result.status), String(result.status));
    }
    const response = await fetch(origin + '/api/internal/profile-activity', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-profile-reader': secret,
      },
      body: JSON.stringify({ ...internalBody, tenantId: 'private' }),
    });
    assert.equal(response.status, 400);
  }
  pass(
    'profile activity: private edits cannot replace reviewed content; all sharing switches and owner preview are enforced; private audiences and forged/mixed internal credentials fail closed'
  );

  await options.discussionSource.query(
    'UPDATE member_reviews SET hidden=1 WHERE id=?',
    [review.id]
  );
  assert.ok(!(await all()).some((item) => item.kind === 'review'));
  await options.discussionSource.query(
    'UPDATE member_reviews SET hidden=0 WHERE id=?',
    [review.id]
  );
  const removed = options.accepted(
    await options.discussion(
      'DELETE',
      `${base(appTarget)}/${topicReply.id}`,
      { expectedRevision: topic.revision },
      actor()
    )
  );
  topic.revision = removed.revision;
  await wait(appTarget, topic.id, topic.revision);
  assert.ok(!(await all()).some((item) => item.id === topicReply.id));
  await reply(topic);
  await withdraw('application', 'application-drafts', ownedDraft.id);
  const hiddenParent = await all();
  assert.ok(
    hiddenParent.every(
      (item) =>
        ![
          'application',
          'release',
          'discussion',
          'reply',
          'review',
          'favorite-application',
          'favorite-discussion',
        ].includes(item.kind)
    )
  );
  await publish('application', 'application-drafts', ownedDraft.id);
  assert.equal((await all()).length, 13);
  pass(
    'profile activity: deletion removes an individual contribution, moderation hides reviews, and current parent withdrawal suppresses retained release/community/favorite activity'
  );

  const direct = (
    method,
    path,
    body,
    uid = owner,
    roles = ['editorial:publisher']
  ) =>
    fetch(options.origin() + '/api/' + path, {
      method,
      headers: {
        ...options.headers(uid, 'default', roles),
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    }).then(accepted);
  const directApp = await direct('POST', 'apps', {
    name: 'Direct activity publication',
    slug: 'direct-activity-app',
    website: 'https://direct.example.test',
    description: 'Direct staff publication.',
  });
  await options.projections.publish(
    projectEditorialSnapshot(await options.reader.read('app', directApp.id))
  );
  assert.equal(
    (await all()).filter((item) => item.kind === 'application').length,
    2
  );
  await direct('DELETE', `apps/${directApp.id}`, {
    expectedRevision: directApp.revision,
  });
  assert.equal((await all()).length, 13);
  const beforeCorrection = await editorial(
    'GET',
    `me/application-drafts/canonical/${application.id}`
  );
  await direct(
    'PUT',
    `apps/${application.id}`,
    {
      name: beforeCorrection.fields.name,
      expectedRevision: beforeCorrection.sourcePublicationRevision,
    },
    'ActivityModerator',
    ['editorial:moderator']
  );
  await options.projections.publish(
    projectEditorialSnapshot(await options.reader.read('app', application.id))
  );
  assert.ok(!(await all()).some((item) => item.kind === 'application'));
  const corrected = await editorial(
    'GET',
    `me/application-drafts/canonical/${application.id}`
  );
  const owned = await editorial(
    'GET',
    `me/application-drafts/${ownedDraft.id}`
  );
  await editorial('POST', `me/application-drafts/${ownedDraft.id}/rebase`, {
    expectedRevision: owned.revision,
    editing: {
      applicationId: application.id,
      claimId: claim.id,
      sourcePublicationRevision: corrected.sourcePublicationRevision,
    },
    fields: corrected.fields,
    imageChoices: { logo: 'canonical', banner: 'canonical' },
  });
  await publish('application', 'application-drafts', ownedDraft.id);
  assert.equal((await all()).length, 13);
  assert.equal(
    (await all()).filter((item) => item.kind === 'application').length,
    1
  );
  pass(
    'profile activity: approved editing drafts resolve to the canonical app once; direct publisher receipts supply attribution, tombstones remove it, and a newer staff publication supersedes earlier authors until a new reviewed publication'
  );

  await options.stopWorker();
  const edited = options.accepted(
    await options.discussion(
      'PUT',
      `${base(appTarget)}/${topic.id}`,
      {
        expectedRevision: topic.revision,
        content: {
          displayName: 'Public member',
          text: 'Updated public contribution',
          title: 'Updated profile activity discussion',
          tags: [],
        },
      },
      actor()
    )
  );
  topic.revision = edited.revision;
  assert.equal((await account(null, route)).status, 503);
  options.startWorker();
  await wait(appTarget, topic.id, topic.revision);
  assert.equal(
    (await all()).find((item) => item.id === topic.id).title,
    'Updated profile activity discussion'
  );
  await options.stopWorker();
  await options.discussionDatabase
    .collection('discussion_generation_nodes')
    .deleteMany({ discussionId: comment.id });
  await options.discussionDatabase
    .collection('discussion_generation_heads')
    .deleteOne({ _id: comment.id });
  assert.equal((await account(null, route)).status, 503);
  options.rebuild();
  options.startWorker();
  await wait(articleTarget, comment.id, comment.revision);
  assert.equal((await all()).length, 13);
  pass(
    'profile activity: stale exact generations and lost projections fail unavailable; worker recovery and rebuild from SQL/object authority restore all public contributions'
  );

  // Delay a real internal response so the canonical privacy check runs after the mutation.
  async function delayedRead(mutation) {
    let notify, release;
    const seen = new Promise((resolve) => {
      notify = resolve;
    });
    const proxy = http.createServer(async (request, response) => {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const upstream = await fetch(options.discussionOrigin() + request.url, {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            ...(request.headers['x-profile-reader']
              ? { 'x-profile-reader': request.headers['x-profile-reader'] }
              : {}),
          },
          ...(body.length ? { body } : {}),
          signal: AbortSignal.timeout(8000),
        });
        const payload = Buffer.from(await upstream.arrayBuffer());
        if (notify && request.url === '/api/internal/profile-activity') {
          const signal = notify;
          notify = null;
          await new Promise((resolve) => {
            release = resolve;
            signal();
          });
        }
        response.writeHead(upstream.status, {
          'content-type': 'application/json',
        });
        response.end(payload);
      } catch {
        response.writeHead(503);
        response.end('{}');
      }
    });
    await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
    try {
      await options.restartAccount(
        undefined,
        `http://127.0.0.1:${proxy.address().port}`
      );
      const pending = account(null, route);
      await Promise.race([
        seen,
        pending.then((response) => {
          throw new Error(
            `Activity read completed before delay: ${response.status}`
          );
        }),
      ]);
      await mutation();
      release();
      release = null;
      return await pending;
    } finally {
      if (release) release();
      await options.restartAccount(undefined, options.discussionOrigin());
      await new Promise((resolve) => proxy.close(resolve));
    }
  }
  for (const mutate of [
    () => privacy('public', false),
    () => privacy('private', true),
  ]) {
    await privacy('public', true);
    assert.equal((await delayedRead(mutate)).status, 404);
  }
  await privacy('public', true);
  await options.restartAccount(undefined, 'http://127.0.0.1:1');
  assert.equal((await account(null, route)).status, 503);
  await privacy('public', false);
  assert.deepEqual(await read(), { sharing: 'hidden', items: [], after: null });
  await options.restartAccount(undefined, options.discussionOrigin());
  await privacy('public', true);
  pass(
    'profile activity: in-flight reads are discarded after sharing or audience changes; a dependency outage is unavailable and disabled activity skips that dependency'
  );

  const hiddenTopics = [];
  for (let index = 0; index < 11; index++)
    hiddenTopics.push(
      await create(appTarget, `Hidden activity candidate ${index}`)
    );
  await withdraw('application', 'application-drafts', ownedDraft.id);
  const hiddenPage = await read();
  assert.deepEqual(hiddenPage.items, []);
  assert.match(hiddenPage.after, /^a1\.[A-Za-z0-9_-]+$/);
  assert.ok(
    hiddenTopics.every(({ id }) => !JSON.stringify(hiddenPage).includes(id))
  );
  assert.equal((await all()).length, 6);
  await publish('application', 'application-drafts', ownedDraft.id);
  for (const topic of hiddenTopics)
    options.accepted(
      await options.discussion(
        'DELETE',
        `${base(appTarget)}/${topic.id}`,
        { expectedRevision: topic.revision },
        actor()
      )
    );
  assert.equal((await all()).length, 13);
  pass(
    'profile activity: a fully hidden ten-candidate page has confidential continuation and advances to older public sources without skipping or leaking hidden identifiers'
  );

  const browserItems = await all();
  function assertLinks(links, expected) {
    assert.equal(links.length, expected.length);
    for (let i = 0; i < links.length; i++) {
      const link = links[i],
        item = expected[i],
        target = item.target;
      assert.ok(link.title.includes(item.title));
      const url = new URL(link.href, 'http://localhost');
      const route =
        target.kind === 'suite'
          ? `/suites/${target.id}`
          : target.kind === 'article' || target.kind === 'comment'
          ? `/articles/${target.slug ?? target.articleSlug}`
          : target.kind === 'application'
          ? `/apps/${target.slug}/overview`
          : target.kind === 'release'
          ? `/apps/${target.applicationSlug}/devlog/${target.version}`
          : `/apps/${target.applicationSlug}/${
              target.kind === 'review' ? 'review' : 'discussions'
            }/${target.id}`;
      assert.equal(decodeURIComponent(url.pathname), route);
      assert.equal(
        url.searchParams.get('thread'),
        target.kind === 'comment' ? target.id : null
      );
      assert.ok(!link.title.includes('Unreviewed private activity title'));
    }
  }

  const {
    publicProfileCollectionBrowser,
  } = require('./public-profile-favorites-browser.cjs');
  await publicProfileCollectionBrowser(
    {
      ...options,
      owner,
      follower,
      ownerId,
      privacy,
      read,
      output: require('node:path').join(
        options.output,
        'public-profile-activity'
      ),
    },
    {
      kind: 'activity',
      title: 'Recent activity',
      controls: 'recent activity',
      setting: 'Show Activity History',
      hidden: 'Activity is not shared',
      changeSharing: 'Change activity sharing',
      emptyText: 'No shared public activity',
      firstCount: 10,
      nextCount: 3,
      restoredCount: 10,
      assertFirst: (links) => assertLinks(links, browserItems.slice(0, 10)),
      assertNext: (links) => assertLinks(links, browserItems.slice(10)),
      assertDetail: async (page) => {
        await page.waitForFunction(() =>
          document
            .querySelector('h1')
            ?.textContent.includes('Profile activity application')
        );
        assert.ok(
          new URL(page.url()).pathname.endsWith(
            '/profile-activity-app/overview'
          )
        );
      },
      assertOwnerDetail: async (page, origin) => {
        await page.goto(origin + `/profiles/${ownerId}`, {
          waitUntil: 'networkidle0',
        });
        await page.waitForFunction(
          () => document.querySelectorAll('.shared-activity a').length === 10
        );
        if (!(await page.$('.shared-activity a[href*="/devlog/"]'))) {
          await page.$$eval('public-profile-page button', (buttons) =>
            buttons
              .find(
                (button) => button.textContent.trim() === 'Next recent activity'
              )
              .click()
          );
        }
        await page.waitForSelector('.shared-activity a[href*="/devlog/"]');
        await page.click('.shared-activity a[href*="/devlog/"]');
        await page.waitForFunction(
          () =>
            document
              .querySelector('h1')
              ?.textContent.includes('Release 2026.10+activity') &&
            [...document.querySelectorAll('.application-draft-card h2')].some(
              (title) => title.textContent.includes('Profile activity release')
            )
        );
        assert.equal(
          decodeURIComponent(new URL(page.url()).pathname),
          '/apps/profile-activity-app/devlog/2026.10+activity'
        );
      },
      empty: async () => {
        await withdraw('application', 'application-drafts', ownedDraft.id);
        await withdraw('suite', 'suites', suite.id);
        await withdraw('article', 'articles', article.id);
      },
      restore: async () => {
        await publish('application', 'application-drafts', ownedDraft.id);
        await publish('suite', 'suites', suite.id);
        await publish('article', 'articles', article.id);
      },
    }
  );
}
module.exports = { publicProfileActivityChecks };
