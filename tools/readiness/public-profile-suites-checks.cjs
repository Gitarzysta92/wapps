const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const {
  projectEditorialSnapshot,
} = require('../../apps/services/editorial/src/app/application/editorial-materialization');

async function publicProfileSuitesChecks(options) {
  const { identities, accountOrigin, accountHeaders, restartAccount, pass } =
    options;
  const owner = 'ProfileSuitesOwner';
  const follower = 'ProfileSuitesFollower';
  const stranger = 'ProfileSuitesStranger';
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
  const anonymous = {
    'x-ingress-auth': accountHeaders(owner)['x-ingress-auth'],
    'x-anonymous': 'true',
  };
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
  const route = `profiles/${ownerId}/suites`;
  const read = async (uid = null, after) =>
    accepted(
      await account(
        uid,
        route + (after ? '?after=' + encodeURIComponent(after) : '')
      )
    );
  const privacy = async (profileVisibility, showSuites) => {
    const current = await identities.getPreferences(owner);
    current.preferences.privacy.profileVisibility = profileVisibility;
    current.preferences.privacy.showSuites = showSuites;
    return accepted(
      await account(owner, 'me/preferences', 'PUT', {
        expectedRevision: current.revision,
        preferences: current.preferences,
      })
    );
  };
  async function editorial(
    method,
    route,
    body,
    uid = owner,
    tenant = 'default',
    roles = []
  ) {
    return accepted(
      await fetch(options.origin() + '/api/' + route, {
        method,
        headers: {
          ...options.headers(uid, tenant, roles),
          'idempotency-key': randomUUID(),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
      })
    );
  }
  const fields = {
    title: 'Reviewed member collection',
    description: 'Approved public description.',
    applicationIds: [options.application.id],
  };
  const project = async (id) =>
    options.projections.publish(
      projectEditorialSnapshot(await options.reader.read('suite', id))
    );
  async function publish(id, uid = owner) {
    const status = await editorial(
      'GET',
      `me/suites/${id}/publication`,
      undefined,
      uid
    );
    const submitted = await editorial(
      'POST',
      `me/suites/${id}/submit`,
      { expectedRevision: status.revision },
      uid
    );
    const current = await editorial(
      'GET',
      `me/suites/${id}/publication`,
      undefined,
      uid
    );
    await editorial(
      'POST',
      `editorial/suite-reviews/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: current.revision,
        submittedRevision:
          submitted.submittedRevision ??
          current.latestSubmission.submittedRevision,
      },
      'ProfileSuitesReviewer',
      'default',
      ['editorial:reviewer']
    );
  }
  async function withdraw(id) {
    const current = await editorial('GET', `me/suites/${id}/publication`);
    await editorial('POST', `me/suites/${id}/withdraw`, {
      expectedRevision: current.revision,
    });
  }
  const suite = await editorial('POST', 'me/suites', fields);
  await publish(suite.id);
  await project(suite.id);
  const other = await editorial(
    'POST',
    'me/suites',
    { ...fields, title: 'Another member collection' },
    stranger
  );
  await publish(other.id, stranger);
  await project(other.id);
  const privateSuite = await editorial('POST', 'me/suites', {
    ...fields,
    title: 'Private title never shared',
  });
  const pending = await editorial('POST', 'me/suites', {
    ...fields,
    title: 'Unreviewed title never shared',
  });
  await editorial('POST', `me/suites/${pending.id}/submit`, {
    expectedRevision: pending.revision,
  });
  assert.equal((await account(null, route)).status, 404);
  await privacy('public', false);
  assert.deepEqual(await read(), { sharing: 'hidden', items: [], after: null });
  assert.deepEqual(await read(owner), {
    sharing: 'hidden',
    items: [],
    after: null,
  });
  await privacy('public', true);
  let page = await read();
  assert.deepEqual(page, {
    sharing: 'visible',
    items: [
      { id: suite.id, title: fields.title, description: fields.description },
    ],
    after: null,
  });
  assert.ok(!JSON.stringify(page).includes(owner));
  for (const hidden of [privateSuite.id, pending.id, other.id])
    assert.ok(!JSON.stringify(page).includes(hidden));
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
    'public profile suites: current approved owner collection, private/pending/other-owner exclusion, strict public payload/query, Show Suites including owner preview and account restart'
  );

  const serviceHeaders = {
    'content-type': 'application/json',
    'x-profile-reader': options.headers(owner)['x-ingress-auth'],
  };
  const internal = (headers, body = { ownerIdentityId: owner, after: null }) =>
    fetch(options.origin() + '/api/internal/profile-suites', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  assert.deepEqual(await accepted(await internal(serviceHeaders)), page);
  for (const headers of [
    { 'content-type': 'application/json' },
    { ...serviceHeaders, 'x-profile-reader': 'wrong' },
    options.headers(stranger, 'default', ['admin']),
    { ...serviceHeaders, authorization: 'Bearer untrusted' },
    { ...serviceHeaders, 'x-user-id': owner },
    { ...serviceHeaders, 'x-ingress-auth': serviceHeaders['x-profile-reader'] },
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
  // Simulate a consistent foreign publication in authority; it must not enter the public tenant.
  for (const table of [
    'private_suites',
    'suite_submissions',
    'editorial_resource_states',
  ]) {
    const column =
      table === 'private_suites'
        ? 'id'
        : table === 'suite_submissions'
        ? 'suiteId'
        : 'resourceId';
    await options.source.query(
      `UPDATE ${table} SET tenantId = ? WHERE ${column} = ?`,
      ['other', suite.id]
    );
  }
  try {
    assert.deepEqual((await read()).items, []);
  } finally {
    for (const table of [
      'private_suites',
      'suite_submissions',
      'editorial_resource_states',
    ]) {
      const column =
        table === 'private_suites'
          ? 'id'
          : table === 'suite_submissions'
          ? 'suiteId'
          : 'resourceId';
      await options.source.query(
        `UPDATE ${table} SET tenantId = ? WHERE ${column} = ?`,
        ['default', suite.id]
      );
    }
  }
  pass(
    'public profile suites: real service credential scoped to internal read, missing/wrong/member/admin/mixed credentials and tenant injection denied; foreign authority excluded'
  );

  await privacy('followers', true);
  assert.equal((await account(null, route)).status, 404);
  assert.equal((await account(stranger, route)).status, 404);
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
  const approvalKey = randomUUID();
  const approval = await follow(owner, 'approve', 1, approvalKey);
  assert.deepEqual(await read(follower), page);
  await follow(owner, 'remove', 2);
  assert.equal((await account(follower, route)).status, 404);
  assert.deepEqual(await follow(owner, 'approve', 1, approvalKey), approval);
  assert.equal((await account(follower, route)).status, 404);
  await privacy('private', true);
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
    'public profile suites: current public/private/follower audience, independent owner approval, revocation, no staff bypass and historical receipts cannot restore access'
  );

  const current = await editorial('GET', `me/suites/${suite.id}/publication`);
  await editorial('PUT', `me/suites/${suite.id}`, {
    ...fields,
    title: 'New reviewed member collection',
    expectedRevision: current.revision,
  });
  assert.equal((await read()).items[0].title, fields.title);
  await publish(suite.id);
  assert.equal((await account(null, route)).status, 503);
  await project(suite.id);
  assert.equal((await read()).items[0].title, 'New reviewed member collection');
  await withdraw(suite.id);
  assert.deepEqual((await read()).items, []);
  await publish(suite.id);
  await project(suite.id);
  pass(
    'public profile suites: private edits retain approved content, republish lag fails unavailable, projection recovery serves new revision and withdrawal hides old projections immediately'
  );

  let release = null;
  let arrived = null;
  let requests = 0;
  const proxy = http.createServer(async (request, response) => {
    requests++;
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(options.origin() + request.url, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          'x-profile-reader': request.headers['x-profile-reader'],
        },
        ...(body.length ? { body } : {}),
        signal: AbortSignal.timeout(8000),
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      if (arrived) {
        const notify = arrived;
        arrived = null;
        await new Promise((resolve) => {
          release = resolve;
          notify();
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
    await restartAccount(`http://127.0.0.1:${proxy.address().port}`);
    for (const mutation of [
      () => privacy('public', false),
      () => privacy('private', true),
    ]) {
      await privacy('public', true);
      const seen = new Promise((resolve) => {
        arrived = resolve;
      });
      const pendingRead = account(null, route);
      await Promise.race([
        seen,
        pendingRead.then((response) => {
          throw new Error(
            `Profile read completed before upstream delay: ${response.status}`
          );
        }),
      ]);
      await mutation();
      release();
      release = null;
      assert.equal((await pendingRead).status, 404);
    }
    await privacy('public', false);
    const before = requests;
    assert.equal((await read()).sharing, 'hidden');
    assert.equal(requests, before);
  } finally {
    if (release) release();
    await restartAccount(options.origin());
    await new Promise((resolve) => proxy.close(resolve));
  }
  await privacy('public', true);
  await restartAccount('http://127.0.0.1:1');
  assert.equal((await account(null, route)).status, 503);
  await privacy('public', false);
  assert.equal((await read()).sharing, 'hidden');
  await restartAccount(options.origin());
  await privacy('public', true);
  pass(
    'public profile suites: sharing/audience changes during real Editorial reads discard old data; hidden sharing skips dependencies and dependency outages stay unavailable'
  );

  const published = [suite.id];
  for (let index = 0; index < 21; index++) {
    const item = await editorial('POST', 'me/suites', {
      ...fields,
      title: `Public collection ${String(index).padStart(2, '0')}`,
    });
    await publish(item.id);
    await project(item.id);
    published.push(item.id);
  }
  page = await read();
  assert.equal(page.items.length, 20);
  assert.equal(page.after, page.items.at(-1).id);
  const next = await read(null, page.after);
  assert.equal(next.items.length, 2);
  assert.equal(next.after, null);
  assert.equal(
    new Set([...page.items, ...next.items].map((item) => item.id)).size,
    22
  );
  const withdrawn = page.items[0].id;
  await withdraw(withdrawn);
  assert.ok(!(await read()).items.some((item) => item.id === withdrawn));
  pass(
    'public profile suites: bounded UUID continuation crosses 20 public results without private IDs/counts; withdrawn result disappears before projection delivery'
  );

  await require('./public-profile-suites-browser.cjs').publicProfileSuitesBrowser(
    {
      ...options,
      owner,
      follower,
      ownerId,
      privacy,
      read,
      empty: async () => {
        for (const id of published.filter((id) => id !== withdrawn))
          await withdraw(id);
      },
      restore: async () => {
        await publish(suite.id);
        await project(suite.id);
      },
      output: require('node:path').join(
        options.output,
        'public-profile-suites'
      ),
    }
  );
}
module.exports = { publicProfileSuitesChecks };
