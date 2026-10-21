const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function publicProfileDiscussionsChecks(options) {
  const { identities, accountOrigin, accountHeaders, restartAccount, pass } =
    options;
  const owner = 'ProfileDiscussionsOwner';
  const follower = 'ProfileDiscussionsFollower';
  const stranger = 'ProfileDiscussionsStranger';
  for (const uid of [owner, follower, stranger]) {
    await identities.ensure({
      uid,
      kind: 'user',
      provider: 'email',
      activate: true,
    });
    await identities.enrollAccount(uid, uid, randomUUID());
  }
  const ownerId = (await identities.find(owner)).subjectId;
  const requesterId = (await identities.find(follower)).subjectId;
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
  const account = (uid, route, method = 'GET', body, key = randomUUID()) =>
    fetch(accountOrigin() + '/api/' + route, {
      method,
      headers: {
        ...(uid ? accountHeaders(uid) : anonymous),
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  const route = `profiles/${ownerId}/discussions`;
  const read = async (uid = null, after) =>
    accepted(
      await account(
        uid,
        route + (after ? '?after=' + encodeURIComponent(after) : '')
      )
    );
  const privacy = async (profileVisibility, showDiscussions) => {
    const current = await identities.getPreferences(owner);
    current.preferences.privacy.profileVisibility = profileVisibility;
    current.preferences.privacy.showDiscussions = showDiscussions;
    return accepted(
      await account(owner, 'me/preferences', 'PUT', {
        expectedRevision: current.revision,
        preferences: current.preferences,
      })
    );
  };
  async function editorial(method, path, body, review = false) {
    return accepted(
      await fetch(options.origin() + '/api/' + path, {
        method,
        headers: {
          ...options.headers(
            review ? 'ProfileDiscussionReviewer' : owner,
            'default',
            review ? ['editorial:reviewer'] : []
          ),
          'idempotency-key': randomUUID(),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
      })
    );
  }
  const article = await editorial('POST', 'me/articles', {
    title: 'Discussion participation article',
    slug: 'profile-participation-article',
    excerpt: 'Public article threads with live member contributions.',
    byline: 'Public author',
    category: 'Guides',
    tags: [],
    sections: [
      { heading: 'Contributions', paragraphs: ['Reviewed public article.'] },
    ],
  });
  async function publishArticle() {
    const status = await editorial(
      'GET',
      `me/articles/${article.id}/publication`
    );
    await editorial('POST', `me/articles/${article.id}/submit`, {
      expectedRevision: status.revision,
      expectedPublicationRevision: status.publicationRevision,
    });
    const current = await editorial(
      'GET',
      `me/articles/${article.id}/publication`
    );
    await editorial(
      'POST',
      `editorial/article-reviews/${article.id}/decision`,
      {
        decision: 'approve',
        reason: '',
        expectedRevision: current.revision,
        expectedPublicationRevision: current.publicationRevision,
        submittedRevision: current.latestSubmission.submittedRevision,
      },
      true
    );
    await options.projections.publish(
      projectEditorialSnapshot(await options.reader.read('article', article.id))
    );
  }
  async function withdrawArticle() {
    const status = await editorial(
      'GET',
      `me/articles/${article.id}/publication`
    );
    await editorial('POST', `me/articles/${article.id}/withdraw`, {
      expectedRevision: status.revision,
      expectedPublicationRevision: status.publicationRevision,
    });
  }
  await publishArticle();
  const application = { kind: 'application', id: options.application.id };
  const articleTarget = { kind: 'article', id: article.id };
  const base = (target) =>
    `${
      target.kind === 'article' ? 'article-comments' : 'application-discussions'
    }/${target.id}`;
  const text = (value) => ({ displayName: 'Public member', text: value });
  async function wait(target, id, revision) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await options.discussion(
        'GET',
        `${base(target)}/${id}`,
        undefined,
        null
      );
      if (result.status === 200 && result.body.revision === revision)
        return result.body;
      assert.ok([200, 503].includes(result.status), JSON.stringify(result));
      await delay(100);
    }
    throw new Error('Profile discussion projection did not converge');
  }
  const roots = [];
  async function create(target, title, uid = owner) {
    const body =
      target.kind === 'article'
        ? text(title)
        : { ...text(title), title, tags: [] };
    const receipt = options.accepted(
      await options.discussion('POST', base(target), body, actor(uid)),
      201
    );
    const root = { ...receipt, target, uid, text: title };
    roots.push(root);
    await wait(target, root.id, root.revision);
    return root;
  }
  async function reply(root, value, uid = owner) {
    const receipt = options.accepted(
      await options.discussion(
        'POST',
        `${base(root.target)}/${root.id}/replies`,
        text(value),
        actor(uid)
      ),
      201
    );
    root.revision = receipt.revision;
    await wait(root.target, root.id, root.revision);
    return receipt;
  }
  async function remove(root, id = root.id, moderator = false) {
    const receipt = options.accepted(
      await options.discussion(
        'DELETE',
        `${base(root.target)}/${id}`,
        { expectedRevision: root.revision },
        actor(moderator ? stranger : owner, moderator ? ['admin'] : [])
      )
    );
    root.revision = receipt.revision;
    if (id !== root.id) await wait(root.target, root.id, root.revision);
  }
  const authoredApp = await create(
    application,
    'Member authored application topic'
  );
  const joinedApp = await create(
    application,
    'Application topic joined by member',
    stranger
  );
  const firstReply = await reply(joinedApp, 'First live member reply');
  const secondReply = await reply(joinedApp, 'Second live member reply');
  const authoredArticle = await create(
    articleTarget,
    'Member authored article thread'
  );
  const joinedArticle = await create(
    articleTarget,
    'Article thread joined by member',
    stranger
  );
  let soleReply = await reply(joinedArticle, 'Only member contribution');
  await create(application, 'Unrelated author topic', stranger);
  assert.equal((await account(null, route)).status, 404);
  await privacy('public', false);
  for (const uid of [null, owner])
    assert.deepEqual(await read(uid), {
      sharing: 'hidden',
      items: [],
      after: null,
    });
  await privacy('public', true);
  let page = await read();
  assert.equal(page.items.length, 4);
  for (const [root, participation] of [
    [authoredApp, 'author'],
    [joinedApp, 'participant'],
    [authoredArticle, 'author'],
    [joinedArticle, 'participant'],
  ]) {
    const entry = page.items.find((item) => item.id === root.id);
    assert.ok(entry);
    assert.equal(entry.parentKind, root.target.kind);
    assert.equal(entry.parentId, root.target.id);
    assert.equal(entry.participation, participation);
    assert.deepEqual(Object.keys(entry).sort(), [
      'createdAt',
      'id',
      'parentId',
      'parentKind',
      'parentSlug',
      'participation',
      'replyCount',
      'title',
    ]);
  }
  assert.ok(!JSON.stringify(page).includes(owner));
  assert.equal(
    page.items.find((item) => item.id === joinedApp.id).replyCount,
    2
  );
  const response = await account(null, route);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
  for (const query of [
    'identityId=Other',
    'tenantId=private',
    'after=x&after=y',
    'after=not-a-cursor',
  ])
    assert.equal((await account(null, route + '?' + query)).status, 400);
  await restartAccount();
  assert.deepEqual(await read(), page);
  pass(
    'public profile discussions: both application and article roots/replies, deduplicated live participation, strict public summaries, owner isolation, Show Discussions including owner preview, query rejection and Account restart'
  );

  const serviceHeaders = {
    'content-type': 'application/json',
    'x-profile-reader': secret,
  };
  const internal = (
    headers = serviceHeaders,
    body = { ownerIdentityId: owner, after: null }
  ) =>
    fetch(options.discussionOrigin() + '/api/internal/profile-discussions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  assert.deepEqual(await accepted(await internal()), page);
  for (const headers of [
    { 'content-type': 'application/json' },
    { ...serviceHeaders, 'x-profile-reader': 'wrong' },
    options.headers(stranger, 'default', ['admin']),
    { ...serviceHeaders, authorization: 'Bearer untrusted' },
    { ...serviceHeaders, 'x-user-id': owner },
    { ...serviceHeaders, 'x-ingress-auth': secret },
  ])
    assert.equal((await internal(headers)).status, 401);
  assert.equal(
    (
      await internal(serviceHeaders, {
        ownerIdentityId: owner,
        tenantId: 'other',
      })
    ).status,
    400
  );
  await options.discussionSource.query(
    'UPDATE discussion_write_aggregates SET tenantId = ? WHERE id = ?',
    ['other', authoredApp.id]
  );
  try {
    assert.ok(!(await read()).items.some((item) => item.id === authoredApp.id));
  } finally {
    await options.discussionSource.query(
      'UPDATE discussion_write_aggregates SET tenantId = ? WHERE id = ?',
      ['default', authoredApp.id]
    );
  }
  pass(
    'public profile discussions: actual internal service authentication rejects missing/wrong/member/admin/mixed credentials and injected scope; current foreign-tenant authority is excluded'
  );

  await privacy('followers', true);
  for (const uid of [null, stranger, follower])
    assert.equal((await account(uid, route)).status, 404);
  const follow = async (uid, action, expectedRevision, key) =>
    accepted(
      await account(
        uid,
        'me/profile-follows',
        'PUT',
        { ownerId, requesterId, action, expectedRevision },
        key
      )
    );
  await follow(follower, 'request', 0);
  assert.equal((await account(follower, route)).status, 404);
  const key = randomUUID();
  const approval = await follow(owner, 'approve', 1, key);
  assert.deepEqual(await read(follower), page);
  await follow(owner, 'remove', 2);
  assert.equal((await account(follower, route)).status, 404);
  assert.deepEqual(await follow(owner, 'approve', 1, key), approval);
  assert.equal((await account(follower, route)).status, 404);
  await privacy('private', true);
  assert.deepEqual(await read(owner), page);
  assert.equal(
    (
      await fetch(accountOrigin() + '/api/' + route, {
        headers: {
          ...accountHeaders(stranger),
          'x-user-claims': '{"roles":["admin","identity:admin"]}',
        },
      })
    ).status,
    404
  );
  await privacy('public', true);
  pass(
    'public profile discussions: independent owner approval, follower revocation, old receipt replay, private owner preview and no staff bypass'
  );

  await remove(joinedApp, firstReply.id);
  assert.equal(
    (await read()).items.find((item) => item.id === joinedApp.id).participation,
    'participant'
  );
  await remove(joinedApp, secondReply.id);
  assert.ok(!(await read()).items.some((item) => item.id === joinedApp.id));
  await reply(joinedApp, 'A renewed current contribution');
  await remove(joinedArticle, soleReply.id);
  assert.ok(!(await read()).items.some((item) => item.id === joinedArticle.id));
  soleReply = await reply(joinedArticle, 'Renewed article participation');
  const moderated = await create(
    application,
    'Root removed by independent moderator'
  );
  await remove(moderated, moderated.id, true);
  assert.ok(!(await read()).items.some((item) => item.id === moderated.id));
  await options.withdraw();
  assert.ok(
    (await read()).items.every((item) => item.parentKind === 'article')
  );
  await options.republish();
  await withdrawArticle();
  assert.ok(
    (await read()).items.every((item) => item.parentKind === 'application')
  );
  await publishArticle();
  pass(
    'public profile discussions: deleting one of several replies retains participation, deleting the sole reply or moderated root removes it, and parent withdrawal immediately excludes retained projections for both families'
  );

  await options.stopWorker();
  const edited = options.accepted(
    await options.discussion(
      'PUT',
      `${base(application)}/${authoredApp.id}`,
      {
        expectedRevision: authoredApp.revision,
        content: {
          ...text('Updated public body'),
          title: 'Updated member application topic',
          tags: [],
        },
      },
      actor()
    )
  );
  authoredApp.revision = edited.revision;
  assert.equal((await account(null, route)).status, 503);
  options.startWorker();
  await wait(application, authoredApp.id, authoredApp.revision);
  assert.equal(
    (await read()).items.find((item) => item.id === authoredApp.id).title,
    'Updated member application topic'
  );
  await options.stopWorker();
  await options.discussionDatabase
    .collection('discussion_generation_nodes')
    .deleteMany({ discussionId: authoredArticle.id });
  await options.discussionDatabase
    .collection('discussion_generation_heads')
    .deleteOne({ _id: authoredArticle.id });
  assert.equal((await account(null, route)).status, 503);
  options.rebuild();
  options.startWorker();
  await wait(articleTarget, authoredArticle.id, authoredArticle.revision);
  assert.equal((await read()).items.length, 4);
  pass(
    'public profile discussions: exact-generation lag and projection loss return unavailable; worker recovery and rebuild from SQL/object authority restore the current collection'
  );

  // Hold real upstream responses at a controlled point, without substituting fixture payloads.
  async function delayedRead(kind, mutation) {
    let notify, release;
    const seen = new Promise((resolve) => {
      notify = resolve;
    });
    const proxy = http.createServer(async (request, response) => {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const upstream = await fetch(
          (kind === 'account' ? options.discussionOrigin() : options.origin()) +
            request.url,
          {
            method: request.method,
            headers: {
              'content-type': 'application/json',
              ...(request.headers['x-profile-reader']
                ? { 'x-profile-reader': request.headers['x-profile-reader'] }
                : {}),
            },
            ...(body.length ? { body } : {}),
            signal: AbortSignal.timeout(8000),
          }
        );
        const payload = Buffer.from(await upstream.arrayBuffer());
        if (
          notify &&
          (kind === 'account' ||
            request.url.startsWith('/api/catalog/article-selection'))
        ) {
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
    const proxyOrigin = `http://127.0.0.1:${proxy.address().port}`;
    try {
      if (kind === 'account') await restartAccount(undefined, proxyOrigin);
      else {
        await options.restart({ editorialOrigin: proxyOrigin });
        await restartAccount(undefined, options.discussionOrigin());
      }
      const pending = account(null, route);
      await Promise.race([
        seen,
        pending.then((response) => {
          throw new Error(`Read completed before delay: ${response.status}`);
        }),
      ]);
      await mutation();
      release();
      release = null;
      return await pending;
    } finally {
      if (release) release();
      if (kind !== 'account') await options.restart();
      await restartAccount(undefined, options.discussionOrigin());
      await new Promise((resolve) => proxy.close(resolve));
    }
  }
  for (const mutation of [
    () => privacy('public', false),
    () => privacy('private', true),
  ]) {
    await privacy('public', true);
    assert.equal((await delayedRead('account', mutation)).status, 404);
  }
  await privacy('public', true);
  const delayed = await delayedRead('parent', () =>
    remove(joinedArticle, soleReply.id)
  );
  assert.ok(
    !(await accepted(delayed)).items.some(
      (item) => item.id === joinedArticle.id
    )
  );
  await reply(joinedArticle, 'Current contribution after concurrent deletion');
  await restartAccount(undefined, 'http://127.0.0.1:1');
  assert.equal((await account(null, route)).status, 503);
  await privacy('public', false);
  assert.equal((await read()).sharing, 'hidden');
  await restartAccount(undefined, options.discussionOrigin());
  await privacy('public', true);
  pass(
    'public profile discussions: real delayed Discussion responses are discarded after privacy changes; deleting participation during delayed parent metadata excludes the old result; hidden sharing works during dependency outage'
  );

  for (let index = 0; index < 8; index++)
    await create(
      index % 2 ? articleTarget : application,
      `Shared contribution ${index}`
    );
  page = await read();
  assert.equal(page.items.length, 10);
  assert.match(page.after, /^v1\.[A-Za-z0-9_-]+$/);
  const next = await read(null, page.after);
  assert.equal(next.items.length, 2);
  assert.equal(next.after, null);
  assert.equal(
    new Set([...page.items, ...next.items].map((item) => item.id)).size,
    12
  );
  const ciphertext = Buffer.from(page.after.slice(3), 'base64url').toString();
  for (const root of roots) assert.ok(!ciphertext.includes(root.id));
  await options.restart();
  await restartAccount(undefined, options.discussionOrigin());
  assert.deepEqual(await read(null, page.after), next);
  for (const body of [
    { ownerIdentityId: stranger, after: page.after },
    {
      ownerIdentityId: owner,
      after:
        page.after.slice(0, 15) +
        (page.after[15] === 'A' ? 'B' : 'A') +
        page.after.slice(16),
    },
  ])
    assert.equal((await internal(serviceHeaders, body)).status, 400);
  const rotated = randomUUID();
  await options.restart({ ingressSecret: rotated });
  assert.equal(
    (
      await internal(
        { ...serviceHeaders, 'x-profile-reader': rotated },
        { ownerIdentityId: owner, after: page.after }
      )
    ).status,
    400
  );
  await options.restart();
  await restartAccount(undefined, options.discussionOrigin());
  const hiddenRoots = [];
  for (let index = 0; index < 10; index++)
    hiddenRoots.push(
      await create(application, `Hidden parent candidate ${index}`)
    );
  await options.withdraw();
  const hiddenPage = await read();
  assert.deepEqual(hiddenPage.items, []);
  assert.ok(hiddenPage.after);
  assert.ok(
    (await read(null, hiddenPage.after)).items.some(
      (item) => item.parentKind === 'article'
    )
  );
  await options.republish();
  for (const root of hiddenRoots) await remove(root);
  pass(
    'public profile discussions: ten-candidate opaque paging has no duplicate roots, survives restart, rejects cross-owner/tampered/rotated-key tokens, and advances past a fully hidden page without exposing hidden candidate identifiers'
  );

  // Bury the profile-linked article thread beyond the first article-comments page.
  for (let index = 0; index < 11; index++)
    await create(
      articleTarget,
      `Unrelated latest article thread ${index}`,
      stranger
    );
  const first = (await read()).items[0];
  assert.equal(first.parentKind, 'article');
  const latest = options.accepted(
    await options.discussion('GET', base(articleTarget), undefined, null)
  );
  assert.ok(!latest.items.some((item) => item.id === first.id));
  await require('./public-profile-discussions-browser.cjs').publicProfileDiscussionsBrowser(
    {
      ...options,
      owner,
      follower,
      ownerId,
      privacy,
      read,
      linkedThreadText: roots.find((root) => root.id === first.id).text,
      waitLinkedReply: () => wait(articleTarget, first.id, 2),
      empty: async () => {
        await options.withdraw();
        await withdrawArticle();
      },
      restore: async () => {
        await options.republish();
        await publishArticle();
      },
      output: require('node:path').join(
        options.output,
        'public-profile-discussions'
      ),
    }
  );
}
module.exports = { publicProfileDiscussionsChecks };
