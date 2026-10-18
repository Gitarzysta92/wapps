const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);
const base = '/api/me/application-drafts';
const reviews = '/api/editorial/application-reviews';
const catalog = '/api/catalog/apps';

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE,
    project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  assert.ok(compose && project && report && process.env.WAPPS_BFF_ACCOUNTS);
  const users = [],
    drafts = [],
    checks = [],
    erased = [],
    stopped = new Set(),
    cleanupErrors = [];
  let failure;
  const persist = () => {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          drafts: drafts.map(({ id, user }) => ({ id, uid: user.uid })),
          disposableIdentities: users.map((u) => u.uid),
          erased,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  };
  const pass = (name) => {
    checks.push(name);
    persist();
    console.log('PASS ' + name);
  };
  async function call(
    path,
    {
      user = users[0],
      method = 'GET',
      body,
      key,
      headers = {},
      status = 200,
    } = {}
  ) {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(25000),
    });
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: HTTP ${response.status}, expected ${status}`
    );
    if (response.ok && path.startsWith('/api/'))
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
    const text = await response.text();
    return {
      response,
      value:
        text.startsWith('[') || text.startsWith('{') ? JSON.parse(text) : null,
    };
  }
  async function until(read, label) {
    let last;
    for (let i = 0; i < 60; i++) {
      try {
        return await read();
      } catch (e) {
        last = e;
        await delay(500);
      }
    }
    throw new Error(label, { cause: last });
  }
  async function service(action, name) {
    if (action === 'stop') stopped.add(name);
    await execute(
      'docker',
      ['compose', '-f', compose, '-p', project, action, name],
      { timeout: 45000, maxBuffer: 65536 }
    );
    if (action === 'start') stopped.delete(name);
    if (action === 'start' && name === 'editorial')
      await service('restart', 'ownership-dns');
  }
  const state = (id, user = users[0]) =>
    call(`${base}/${id}/publication`, { user }).then((r) => r.value);
  const change = (
    id,
    action,
    body,
    { user = users[0], key = randomUUID(), status = 201 } = {}
  ) => {
    const review = action === 'approve' || action === 'reject';
    return call(
      review ? `${reviews}/${id}/decision` : `${base}/${id}/${action}`,
      {
        user,
        method: 'POST',
        body: review ? { ...body, decision: action } : body,
        key,
        status,
      }
    ).then((r) => r.value);
  };
  async function create(fields, user = users[0]) {
    const result = (
      await call(base, {
        user,
        method: 'POST',
        body: fields,
        key: randomUUID(),
        status: 201,
      })
    ).value;
    drafts.push({ id: result.id, user });
    persist();
    return result;
  }
  const update = (id, body) =>
    call(`${base}/${id}`, { method: 'PUT', body, key: randomUUID() });
  const fieldsOf = ({ name, slug, website, description, classification }) => ({
    name,
    slug,
    website,
    description,
    classification,
  });
  async function projection(id) {
    assert.ok(drafts.some((d) => d.id === id));
    // Observe only the disposable projection; credentials remain in Editorial's container.
    const script = `const {MongoClient}=require('mongodb');
      (async()=>{const e=process.env;const c=new MongoClient('mongodb://'+encodeURIComponent(e.MONGO_USERNAME)+':'+encodeURIComponent(e.MONGO_PASSWORD)+'@'+e.MONGO_HOST+':'+e.MONGO_PORT,{serverSelectionTimeoutMS:3000});
      try{await c.connect();const p=await c.db(e.MONGO_DATABASE).collection('editorial_projections_v1').findOne({kind:'app',resourceId:process.argv[1]},{projection:{_id:0,resourceId:1,revision:1,deletedAt:1}});console.log(JSON.stringify(p));}finally{await c.close();}})().catch(()=>{console.error('Projection observation failed');process.exitCode=1;});`;
    const result = await execute(
      'docker',
      [
        'compose',
        '-f',
        compose,
        '-p',
        project,
        'exec',
        '-T',
        'editorial',
        'node',
        '-e',
        script,
        id,
      ],
      { timeout: 10000, maxBuffer: 4096 }
    );
    return JSON.parse(result.stdout);
  }
  try {
    const existing = JSON.parse(
      readFileSync(process.env.WAPPS_BFF_ACCOUNTS, 'utf8')
    );
    const staff = (
      await call('/auth/signin', {
        user: null,
        method: 'POST',
        body: {
          email: existing.staff.email,
          password: existing.staff.password,
        },
      })
    ).value;
    assert.equal(staff.uid, existing.staff.uid);
    for (const nickname of [
      'BFF Application Author',
      'BFF Application Other',
    ]) {
      const user = {
        email: 'bff-app-publication-' + randomUUID() + '@wapps-review.test',
        password: randomUUID() + '!Aa1',
        nickname,
        registrationKey: randomUUID(),
      };
      users.push(user);
      persist();
      Object.assign(
        user,
        (
          await call('/auth/register', {
            user: null,
            method: 'POST',
            key: user.registrationKey,
            body: {
              email: user.email,
              password: user.password,
              passwordConfirmation: user.password,
              nickname,
            },
          })
        ).value
      );
      assert.ok(user.uid && user.token);
      persist();
    }
    const [owner, other] = users;
    const fields = {
      name: 'BFF publication ' + randomUUID().slice(0, 8),
      slug: 'bff-publication-' + randomUUID(),
      website: 'https://application.example.test',
      description: 'Frozen public application proposal with enough detail.',
      classification: 'general',
    };
    const { id } = await create(fields);
    const privatePath = `${base}/${id}/publication`,
      reviewPath = `${reviews}/${id}`,
      publicPath = `${catalog}/${fields.slug}`;
    const selectionPath = '/api/catalog/app-selection?ids=' + id;
    assert.deepEqual(await state(id), {
      id,
      revision: 1,
      publicationRevision: null,
      publishedSubmissionRevision: null,
      publicSlug: null,
      latestSubmission: null,
    });
    for (const user of [null, { token: 'invalid-session' }])
      await call(privatePath, { user, status: 401 });
    await call(privatePath, { user: other, status: 404 });
    await call(privatePath + '?owner=' + other.uid, { status: 400 });
    await call(reviews, { status: 403 });
    await call(reviewPath, { user: other, status: 403 });
    await call(publicPath, { user: null, status: 404 });
    await change(
      id,
      'submit',
      { expectedRevision: 1 },
      { user: null, status: 401 }
    );
    pass(
      'private status and review enforce verified identity and canonical owner/staff access; unpublished drafts remain absent from the catalog'
    );

    const submitBody = { expectedRevision: 1 },
      submitKey = randomUUID();
    const submitted = await change(id, 'submit', submitBody, {
      key: submitKey,
    });
    assert.equal(submitted.revision, 2);
    assert.equal(submitted.submittedRevision, 1);
    assert.deepEqual(
      await change(id, 'submit', submitBody, { key: submitKey }),
      submitted
    );
    await change(
      id,
      'submit',
      { expectedRevision: 2 },
      { key: submitKey, status: 409 }
    );
    const edited = {
      ...fields,
      name: fields.name + ' revised',
      description:
        'Revised application description, independently submitted for staff review.',
      classification: 'mature',
    };
    await update(id, { ...edited, expectedRevision: 2 });
    const frozen = await state(id);
    assert.deepEqual(fieldsOf(frozen.latestSubmission), fields);
    assert.deepEqual(frozen.latestSubmission.images, {
      logo: null,
      banner: null,
    });
    assert.deepEqual((await call(reviewPath, { user: staff })).value, frozen);
    assert.ok(
      (await call(reviews, { user: staff })).value.items.some(
        (item) => item.id === id
      )
    );
    await call(reviews + '?page=10000', { user: staff });
    await call(reviews + '?page=10001', { user: staff, status: 400 });
    for (const body of [
      { expectedRevision: 2, submittedRevision: 1 },
      { expectedRevision: 3, submittedRevision: 2 },
    ])
      await change(id, 'approve', body, { user: staff, status: 409 });
    await change(
      id,
      'approve',
      { expectedRevision: 3, submittedRevision: 1 },
      { status: 403 }
    );
    await call(reviewPath + '/decision', {
      method: 'POST',
      key: randomUUID(),
      body: { decision: 'approve', expectedRevision: 3, submittedRevision: 1 },
      status: 403,
      headers: {
        'X-User-Id': staff.uid,
        'X-User-Claims': '{"roles":["admin"]}',
        'X-Ingress-Auth': 'forged',
      },
    });
    await change(
      id,
      'approve',
      { expectedRevision: 3, submittedRevision: 1, classification: 'general' },
      { user: staff, status: 400 }
    );
    pass(
      'submission replay retains frozen fields/classification/images despite later draft edits; stale reviews, field overrides and spoofed staff headers fail'
    );

    const self = await create(
      { ...fields, slug: fields.slug + '-self' },
      staff
    );
    await change(self.id, 'submit', { expectedRevision: 1 }, { user: staff });
    await call(`${reviews}/${self.id}`, { user: staff, status: 403 });
    await change(
      self.id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      { user: staff, status: 403 }
    );
    await change(self.id, 'withdraw', { expectedRevision: 2 }, { user: staff });
    assert.equal(
      (await state(self.id, staff)).latestSubmission.status,
      'cancelled'
    );
    pass(
      'even staff cannot review their own application; owner withdrawal cancels a pending frozen submission'
    );

    await change(
      id,
      'reject',
      { expectedRevision: 3, submittedRevision: 1, reason: ' ' },
      { user: staff, status: 400 }
    );
    const rejectBody = {
        expectedRevision: 3,
        submittedRevision: 1,
        reason: 'Please revise the application description.',
      },
      rejectKey = randomUUID();
    const rejected = await change(id, 'reject', rejectBody, {
      user: staff,
      key: rejectKey,
    });
    assert.deepEqual(
      await change(id, 'reject', rejectBody, { user: staff, key: rejectKey }),
      rejected
    );
    assert.equal((await state(id)).latestSubmission.reason, rejectBody.reason);
    await change(id, 'submit', { expectedRevision: 4 });
    await update(id, {
      ...edited,
      description:
        'This additional private-only edit must not reach the catalog.',
      expectedRevision: 5,
    });
    assert.deepEqual(fieldsOf((await state(id)).latestSubmission), edited);
    pass(
      'rejection requires and preserves a reason; resubmission freezes revised content while later edits stay private'
    );

    await service('stop', 'editorial-materializer');
    const approveBody = {
        expectedRevision: 6,
        submittedRevision: 4,
        reason: 'Independent staff approval',
      },
      approveKey = randomUUID();
    const approved = await change(id, 'approve', approveBody, {
      user: staff,
      key: approveKey,
    });
    assert.equal(approved.revision, 7);
    assert.equal(approved.publicationRevision, 1);
    for (const path of [
      publicPath,
      selectionPath,
      catalog + '?search=' + encodeURIComponent(fields.name),
    ])
      await call(path, { user: null, status: 503 });
    assert.equal((await state(id)).latestSubmission.status, 'approved');
    await service('start', 'editorial-materializer');
    const published = await until(
      () => call(publicPath, { user: null }).then((r) => r.value),
      'Application projection did not arrive'
    );
    assert.deepEqual(fieldsOf(published), edited);
    assert.equal(published.id, id);
    assert.equal(published.revision, 1);
    for (const field of [
      'latestSubmission',
      'editing',
      'reason',
      'ownerIdentityId',
      'reviewerIdentityId',
    ])
      assert.equal(published[field], undefined);
    assert.deepEqual((await call(selectionPath, { user: null })).value.items, [
      published,
    ]);
    const independent = (
      await call('/auth/signin', {
        user: null,
        method: 'POST',
        body: { email: owner.email, password: owner.password },
      })
    ).value;
    assert.deepEqual(await state(id, independent), await state(id));
    pass(
      'approval commits canonical state during projection lag; public reads recover the frozen content without private review metadata, and status survives independent sign-in'
    );

    const collision = await create(
      { ...fields, name: 'Collision fixture' },
      other
    );
    await change(
      collision.id,
      'submit',
      { expectedRevision: 1 },
      { user: other }
    );
    await change(
      collision.id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      { user: staff, status: 409 }
    );
    assert.equal(
      (await state(collision.id, other)).latestSubmission.status,
      'submitted'
    );
    assert.deepEqual((await call(publicPath, { user: null })).value, published);
    await change(
      collision.id,
      'withdraw',
      { expectedRevision: 2 },
      { user: other }
    );
    pass(
      'public slug collision conflicts atomically, leaving review pending and the existing publication unchanged'
    );

    const routes = [
      [privatePath, owner],
      [privatePath.toUpperCase() + '/', owner],
      [reviewPath, staff],
      [reviews, staff],
      [reviews.toUpperCase() + '/', staff],
      [reviewPath + '/unknown', staff],
    ];
    await service('stop', 'catalog-bff');
    for (const [path, user] of routes)
      await call(path, { user, status: [502, 504] });
    for (const action of ['submit', 'withdraw', 'approve', 'reject'])
      await change(
        id,
        action,
        action === 'approve' || action === 'reject'
          ? { ...approveBody, reason: 'Review' }
          : { expectedRevision: 7 },
        {
          user: action === 'approve' || action === 'reject' ? staff : owner,
          status: [502, 504],
        }
      );
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await until(() => state(id), 'BFF did not recover');
    assert.deepEqual(
      await change(id, 'approve', approveBody, {
        user: staff,
        key: approveKey,
      }),
      approved
    );
    assert.deepEqual((await call(publicPath, { user: null })).value, published);
    pass(
      'every application publication/review family requires BFF, including case/slash variants and unknown suffixes; restart preserves receipts and public content'
    );

    await service('stop', 'editorial');
    for (const [path, user] of [
      [privatePath, owner],
      [reviewPath, staff],
      [reviews, staff],
    ])
      await call(path, { user, status: 503 });
    await change(id, 'approve', approveBody, {
      user: staff,
      key: approveKey,
      status: 503,
    });
    await change(id, 'withdraw', { expectedRevision: 7 }, { status: 503 });
    await call('/api/me/profile');
    await service('start', 'editorial');
    await until(() => state(id), 'Editorial did not recover');
    assert.deepEqual(
      await change(id, 'approve', approveBody, {
        user: staff,
        key: approveKey,
      }),
      approved
    );
    assert.deepEqual((await call(publicPath, { user: null })).value, published);
    pass(
      'Editorial outage returns explicit safe failures; service and DNS recovery preserve canonical state and original-key approval replay'
    );

    await service('stop', 'mongodb');
    await update(id, {
      ...edited,
      description:
        'A future application revision for another independent review.',
      expectedRevision: 7,
    });
    await change(id, 'submit', { expectedRevision: 8 });
    assert.equal(
      (await call(reviewPath, { user: staff })).value.latestSubmission
        .submittedRevision,
      8
    );
    await change(
      id,
      'reject',
      {
        expectedRevision: 9,
        submittedRevision: 8,
        reason: 'Keep the current published version.',
      },
      { user: staff }
    );
    await call(publicPath, { user: null, status: 503 });
    await service('start', 'mongodb');
    assert.deepEqual(
      await until(
        () => call(publicPath, { user: null }).then((r) => r.value),
        'Mongo did not recover'
      ),
      published
    );
    pass(
      'private submission and staff review stay authoritative during Mongo outage; rejected changes leave the prior public snapshot intact'
    );

    await update(id, {
      ...edited,
      description:
        'Replacement publication followed immediately by withdrawal.',
      expectedRevision: 10,
    });
    await change(id, 'submit', { expectedRevision: 11 });
    await service('stop', 'editorial-materializer');
    const replacementBody = { expectedRevision: 12, submittedRevision: 11 },
      replacementKey = randomUUID();
    const replacement = await change(id, 'approve', replacementBody, {
      user: staff,
      key: replacementKey,
    });
    assert.equal(replacement.publicationRevision, 2);
    const stale = await projection(id);
    assert.equal(stale.revision, 1);
    assert.equal(stale.deletedAt, null);
    await call(publicPath, { user: null, status: 503 });
    const withdrawBody = { expectedRevision: 13 },
      withdrawKey = randomUUID();
    const withdrawn = await change(id, 'withdraw', withdrawBody, {
      key: withdrawKey,
    });
    assert.equal(withdrawn.publicationRevision, 3);
    assert.deepEqual(
      await change(id, 'withdraw', withdrawBody, { key: withdrawKey }),
      withdrawn
    );
    await call(publicPath, { user: null, status: 404 });
    assert.deepEqual(
      (await call(selectionPath, { user: null })).value.items,
      []
    );
    assert.equal(
      (
        await call(catalog + '?search=' + encodeURIComponent(fields.name), {
          user: null,
        })
      ).value.total,
      0
    );
    assert.deepEqual(await projection(id), stale);
    pass(
      'replacement lag fails explicitly and withdrawal hides public content immediately while the previous live projection still exists'
    );

    await service('start', 'editorial-materializer');
    await until(async () => {
      const p = await projection(id);
      assert.equal(p.revision, 3);
      assert.ok(p.deletedAt !== null);
      return p;
    }, 'Publication did not converge to tombstone');
    for (const [body, key, expected] of [
      [approveBody, approveKey, approved],
      [replacementBody, replacementKey, replacement],
    ])
      assert.deepEqual(
        await change(id, 'approve', body, { user: staff, key }),
        expected
      );
    assert.equal((await state(id)).publicSlug, null);
    await service('stop', 'editorial');
    await service('start', 'editorial');
    await until(() => state(id), 'Editorial did not recover after withdrawal');
    assert.deepEqual(
      await change(id, 'submit', submitBody, { key: submitKey }),
      submitted
    );
    await call(publicPath, { user: null, status: 404 });
    assert.equal((await projection(id)).revision, 3);
    pass(
      'queued replacement/withdrawal converge to the canonical tombstone; historical receipts and restart cannot resurrect publication'
    );
  } catch (error) {
    failure = error;
  } finally {
    for (const name of [...stopped])
      try {
        await service('start', name);
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const draft of [...drafts].reverse())
      try {
        await until(
          () => call(base, { user: draft.user }),
          'Services did not recover for draft cleanup'
        );
        const current = await call(`${base}/${draft.id}`, {
          user: draft.user,
          status: [200, 404],
        });
        if (current.response.status === 200) {
          const key = randomUUID(),
            body = { expectedRevision: current.value.revision };
          const deleted = (
            await call(`${base}/${draft.id}`, {
              user: draft.user,
              method: 'DELETE',
              body,
              key,
            })
          ).value;
          assert.equal(deleted.deleted, true);
          assert.deepEqual(
            (
              await call(`${base}/${draft.id}`, {
                user: draft.user,
                method: 'DELETE',
                body,
                key,
              })
            ).value,
            deleted
          );
        }
        await call(`${base}/${draft.id}`, { user: draft.user, status: 404 });
        assert.deepEqual(
          (
            await call('/api/catalog/app-selection?ids=' + draft.id, {
              user: null,
            })
          ).value.items,
          []
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const user of [...users].reverse()) {
      if (!user.uid) continue;
      try {
        await call('/api/me', { user, method: 'DELETE', status: 202 });
        erased.push(user.uid);
        persist();
        await call(base, { user, status: [401, 403] });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Publication cleanup incomplete; use recovery records'
        : 'Publication qualification failed'
    );
  pass(
    'new drafts/publications are removed, deletion replay is stable and disposable-account erasure is accepted; existing staff and content remain intact'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
