const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);
const base = '/api/me/suites';
const reviews = '/api/editorial/suite-reviews';
const catalog = '/api/catalog/suites';

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  assert.ok(compose && project && report && process.env.WAPPS_BFF_ACCOUNTS);
  const users = [],
    suites = [],
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
          suites: suites.map((s) => s.id),
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
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        return await read();
      } catch (error) {
        last = error;
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
  }
  const readStatus = (id, user = users[0]) =>
    call(`${base}/${id}/publication`, { user }).then((r) => r.value);
  const change = (
    id,
    action,
    body,
    key = randomUUID(),
    user = users[0],
    status = 201
  ) =>
    call(
      action === 'approve' || action === 'reject'
        ? `${reviews}/${id}/decision`
        : `${base}/${id}/${action}`,
      {
        user,
        method: 'POST',
        body:
          action === 'approve' || action === 'reject'
            ? { ...body, decision: action }
            : body,
        key,
        status,
      }
    ).then((r) => r.value);
  const create = async (fields, user = users[0]) => {
    const receipt = (
      await call(base, {
        user,
        method: 'POST',
        body: fields,
        key: randomUUID(),
        status: 201,
      })
    ).value;
    suites.push({ id: receipt.id, user });
    persist();
    return receipt;
  };
  const update = (id, body) =>
    call(`${base}/${id}`, { method: 'PUT', body, key: randomUUID() });
  const fieldsOf = ({
    title,
    description,
    applicationIds,
    classification,
  }) => ({ title, description, applicationIds, classification });
  async function projection(id) {
    assert.ok(suites.some((suite) => suite.id === id));
    // Read only this run's projection; credentials stay inside the owning service container.
    const script = `const {MongoClient}=require('mongodb');
      (async()=>{const e=process.env;const c=new MongoClient('mongodb://'+encodeURIComponent(e.MONGO_USERNAME)+':'+encodeURIComponent(e.MONGO_PASSWORD)+'@'+e.MONGO_HOST+':'+e.MONGO_PORT,{serverSelectionTimeoutMS:3000});
      try{await c.connect();const p=await c.db(e.MONGO_DATABASE).collection('editorial_projections_v1').findOne({kind:'suite',resourceId:process.argv[1]},{projection:{_id:0,resourceId:1,revision:1,deletedAt:1}});console.log(JSON.stringify(p));}finally{await c.close();}})().catch(()=>{console.error('Projection observation failed');process.exitCode=1;});`;
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
    assert.ok(existing.staff?.email && existing.staff?.password);
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
    for (const nickname of ['BFF Publication Owner', 'BFF Publication Other']) {
      const user = {
        email: 'bff-publication-' + randomUUID() + '@wapps-review.test',
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
      persist();
      assert.ok(user.uid && user.token);
    }
    const [owner, other] = users;
    const apps = (
      await call('/api/catalog/apps?search=&page=1&pageSize=20&sort=name', {
        user: null,
      })
    ).value.items;
    assert.ok(
      apps.length >= 2,
      'Provide two existing public applications without reseeding'
    );
    const fields = {
      title: 'BFF publication ' + randomUUID().slice(0, 8),
      description: 'Frozen proposal',
      applicationIds: apps.slice(0, 2).map((app) => app.id),
      classification: 'general',
    };
    const { id } = await create(fields);
    const privatePath = `${base}/${id}/publication`,
      reviewPath = `${reviews}/${id}`,
      publicPath = `${catalog}/${id}`,
      selectionPath = '/api/catalog/suite-selection?ids=' + id;
    assert.deepEqual(await readStatus(id), {
      id,
      revision: 1,
      publicationRevision: null,
      publishedSubmissionRevision: null,
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
      randomUUID(),
      null,
      401
    );
    pass(
      'private status and staff review enforce verified identity and canonical authorization; drafts are absent from public reads'
    );

    const submitKey = randomUUID(),
      submitBody = { expectedRevision: 1 };
    const submitted = await change(id, 'submit', submitBody, submitKey);
    assert.equal(submitted.revision, 2);
    assert.equal(submitted.submittedRevision, 1);
    assert.deepEqual(
      await change(id, 'submit', submitBody, submitKey),
      submitted
    );
    await change(id, 'submit', { expectedRevision: 2 }, submitKey, owner, 409);
    const edited = {
      ...fields,
      title: fields.title + ' revised',
      description: 'Second proposal',
      applicationIds: [...fields.applicationIds].reverse(),
      classification: 'mature',
    };
    await update(id, { ...edited, expectedRevision: 2 });
    const frozen = await readStatus(id);
    assert.equal(frozen.revision, 3);
    assert.deepEqual(fieldsOf(frozen.latestSubmission), fields);
    assert.deepEqual((await call(reviewPath, { user: staff })).value, frozen);
    const queue = (await call(reviews, { user: staff })).value;
    assert.ok(queue.items.some((item) => item.id === id));
    await change(
      id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      randomUUID(),
      staff,
      409
    );
    await change(
      id,
      'approve',
      { expectedRevision: 3, submittedRevision: 2 },
      randomUUID(),
      staff,
      409
    );
    await change(
      id,
      'approve',
      { expectedRevision: 3, submittedRevision: 1 },
      randomUUID(),
      owner,
      403
    );
    await call(reviewPath + '/decision', {
      method: 'POST',
      body: { decision: 'approve', expectedRevision: 3, submittedRevision: 1 },
      key: randomUUID(),
      headers: {
        'X-User-Id': staff.uid,
        'X-User-Claims': '{"roles":["admin"]}',
        'X-Ingress-Auth': 'forged',
      },
      status: 403,
    });
    await change(
      id,
      'approve',
      { expectedRevision: 3, submittedRevision: 1, classification: 'general' },
      randomUUID(),
      staff,
      400
    );
    pass(
      'submission replay preserves the immutable proposal; later draft edits do not alter staff review, and stale decisions or spoofed staff claims fail'
    );

    const staffDraft = await create(
      { ...fields, title: fields.title + ' self-review' },
      staff
    );
    await change(
      staffDraft.id,
      'submit',
      { expectedRevision: 1 },
      randomUUID(),
      staff
    );
    await change(
      staffDraft.id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      randomUUID(),
      staff,
      403
    );
    const cancelled = await change(
      staffDraft.id,
      'withdraw',
      { expectedRevision: 2 },
      randomUUID(),
      staff
    );
    assert.equal(cancelled.submittedRevision, 1);
    assert.equal(
      (await readStatus(staffDraft.id, staff)).latestSubmission.status,
      'cancelled'
    );
    pass(
      'even staff cannot approve their own suite; withdrawal cancels a pending immutable submission'
    );

    const rejectKey = randomUUID(),
      rejectBody = {
        expectedRevision: 3,
        submittedRevision: 1,
        reason: 'Please revise the collection',
      };
    const rejected = await change(id, 'reject', rejectBody, rejectKey, staff);
    assert.deepEqual(
      await change(id, 'reject', rejectBody, rejectKey, staff),
      rejected
    );
    assert.equal(
      (await readStatus(id)).latestSubmission.reason,
      rejectBody.reason
    );
    await call(publicPath, { user: null, status: 404 });
    await change(id, 'submit', { expectedRevision: 4 });
    await update(id, {
      ...edited,
      title: fields.title + ' private-only edit',
      expectedRevision: 5,
    });
    assert.deepEqual(fieldsOf((await readStatus(id)).latestSubmission), edited);
    pass(
      'rejection reasons remain in private review state; resubmission freezes the revised title, classification and application order'
    );

    await service('stop', 'editorial-materializer');
    const approveKey = randomUUID(),
      approveBody = {
        expectedRevision: 6,
        submittedRevision: 4,
        reason: 'Independent staff approval',
      };
    const approved = await change(
      id,
      'approve',
      approveBody,
      approveKey,
      staff
    );
    assert.equal(approved.revision, 7);
    assert.equal(approved.publicationRevision, 1);
    for (const path of [
      publicPath,
      selectionPath,
      catalog + '?q=' + encodeURIComponent(fields.title),
    ]) {
      const result = await call(path, { user: null, status: 503 });
      assert.equal(result.response.headers.get('retry-after'), '2');
    }
    assert.equal((await readStatus(id)).latestSubmission.status, 'approved');
    await service('start', 'editorial-materializer');
    const published = await until(
      () => call(publicPath, { user: null }).then((r) => r.value),
      'Public suite projection did not recover'
    );
    assert.deepEqual(fieldsOf(published), edited);
    assert.equal(published.revision, 1);
    assert.equal(published.submittedRevision, 4);
    assert.deepEqual(
      Object.keys(published).sort(),
      [
        'id',
        'revision',
        'submittedRevision',
        'publishedAt',
        'title',
        'description',
        'applicationIds',
        'classification',
      ].sort()
    );
    const page = (
      await call(
        catalog +
          '?q=' +
          encodeURIComponent(fields.title) +
          '&page=1&pageSize=1&sort=name-desc',
        { user: null }
      )
    ).value;
    assert.deepEqual(page.items, [published]);
    assert.equal(page.pageSize, 1);
    assert.deepEqual(
      (await call(selectionPath + ',' + randomUUID(), { user: null })).value
        .items,
      [published]
    );
    const independent = (
      await call('/auth/signin', {
        user: null,
        method: 'POST',
        body: { email: owner.email, password: owner.password },
      })
    ).value;
    assert.deepEqual(
      (await call(privatePath, { user: independent })).value,
      await readStatus(id)
    );
    pass(
      'approved suites fail explicitly while projection delivery is paused, then become anonymously readable with exact frozen content and no private review data'
    );

    await service('stop', 'catalog-bff');
    for (const [path, user] of [
      [privatePath, owner],
      [privatePath.toUpperCase() + '/', owner],
      [reviewPath, staff],
      [reviews + '/', staff],
      [reviews.toUpperCase(), staff],
      [publicPath, null],
      [catalog, null],
      [catalog.toUpperCase() + '/', null],
      [selectionPath, null],
      ['/api/catalog/Suite-Selection/?ids=' + id, null],
      [`${base}/${id}/unknown`, owner],
    ])
      await call(path, { user, status: [502, 504] });
    for (const action of ['submit', 'withdraw', 'approve'])
      await change(
        id,
        action,
        action === 'approve' ? approveBody : { expectedRevision: 7 },
        randomUUID(),
        action === 'approve' ? staff : owner,
        [502, 504]
      );
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await until(() => readStatus(id), 'BFF did not recover');
    assert.deepEqual(
      await change(id, 'approve', approveBody, approveKey, staff),
      approved
    );
    assert.deepEqual((await call(publicPath, { user: null })).value, published);
    pass(
      'all suite publication, review and public route families require BFF, including case/slash variants; restart preserves content and command receipts'
    );

    await service('stop', 'editorial');
    for (const [path, user] of [
      [privatePath, owner],
      [reviewPath, staff],
      [reviews, staff],
      [publicPath, null],
      [catalog, null],
      [selectionPath, null],
    ])
      await call(path, { user, status: 503 });
    await change(id, 'approve', approveBody, approveKey, staff, 503);
    await change(
      id,
      'withdraw',
      { expectedRevision: 7 },
      randomUUID(),
      owner,
      503
    );
    await call('/api/me/profile');
    await service('start', 'editorial');
    await until(() => readStatus(id), 'Editorial did not recover');
    assert.deepEqual(
      await change(id, 'approve', approveBody, approveKey, staff),
      approved
    );
    assert.deepEqual((await call(publicPath, { user: null })).value, published);
    pass(
      'Editorial outage returns safe failures; restart and retained-key replay preserve one approval and the public snapshot'
    );

    await update(id, {
      ...fields,
      title: fields.title + ' future version',
      expectedRevision: 7,
    });
    await change(id, 'submit', { expectedRevision: 8 });
    await change(
      id,
      'reject',
      {
        expectedRevision: 9,
        submittedRevision: 8,
        reason: 'Keep the earlier publication',
      },
      randomUUID(),
      staff
    );
    assert.deepEqual((await call(publicPath, { user: null })).value, published);
    await change(id, 'submit', { expectedRevision: 10 });
    await service('stop', 'editorial-materializer');
    const replacementKey = randomUUID(),
      replacementBody = { expectedRevision: 11, submittedRevision: 10 };
    const replacement = await change(
      id,
      'approve',
      replacementBody,
      replacementKey,
      staff
    );
    assert.equal(replacement.publicationRevision, 2);
    await call(publicPath, { user: null, status: 503 });
    const staleProjection = await projection(id);
    assert.equal(staleProjection.revision, 1);
    assert.equal(staleProjection.deletedAt, null);
    const withdrawKey = randomUUID(),
      withdrawBody = { expectedRevision: 12 };
    const withdrawn = await change(id, 'withdraw', withdrawBody, withdrawKey);
    assert.equal(withdrawn.publicationRevision, 3);
    assert.equal(withdrawn.submittedRevision, null);
    assert.deepEqual(
      await change(id, 'withdraw', withdrawBody, withdrawKey),
      withdrawn
    );
    await call(publicPath, { user: null, status: 404 });
    assert.deepEqual(
      (await call(selectionPath, { user: null })).value.items,
      []
    );
    assert.equal(
      (
        await call(catalog + '?q=' + encodeURIComponent(fields.title), {
          user: null,
        })
      ).value.total,
      0
    );
    assert.deepEqual(await projection(id), staleProjection);
    pass(
      'rejection preserves the earlier publication; replacement lag returns 503 and withdrawal hides it immediately despite a still-live stale projection'
    );

    await service('start', 'editorial-materializer');
    await until(async () => {
      const current = await projection(id);
      assert.equal(current.revision, 3);
      assert.ok(current.deletedAt !== null);
      return current;
    }, 'Queued publication and withdrawal did not converge to a tombstone');
    assert.deepEqual(
      await change(id, 'approve', approveBody, approveKey, staff),
      approved
    );
    assert.deepEqual(
      await change(id, 'approve', replacementBody, replacementKey, staff),
      replacement
    );
    await call(publicPath, { user: null, status: 404 });
    assert.equal((await readStatus(id)).publishedSubmissionRevision, null);
    await service('stop', 'editorial');
    await service('start', 'editorial');
    await until(
      () => readStatus(id),
      'Editorial did not recover after withdrawal'
    );
    assert.deepEqual(
      await change(id, 'submit', submitBody, submitKey),
      submitted
    );
    await call(publicPath, { user: null, status: 404 });
    assert.equal((await projection(id)).revision, 3);
    pass(
      'queued replacement and withdrawal converge to the current tombstone; historical submit/approval receipts and restart cannot resurrect public content'
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
    for (const suite of suites)
      try {
        await until(
          () => call(base, { user: suite.user }),
          'Suite services did not recover for cleanup'
        );
        const publication = await call(`${base}/${suite.id}/publication`, {
          user: suite.user,
          status: [200, 404],
        });
        if (
          publication.response.status === 200 &&
          (publication.value.publishedSubmissionRevision !== null ||
            publication.value.latestSubmission?.status === 'submitted')
        )
          await change(
            suite.id,
            'withdraw',
            {
              expectedRevision: publication.value.revision,
            },
            randomUUID(),
            suite.user
          );
        const current = await call(base + '/' + suite.id, {
          user: suite.user,
          status: [200, 404],
        });
        if (current.response.status === 200)
          await call(base + '/' + suite.id, {
            user: suite.user,
            method: 'DELETE',
            body: { expectedRevision: current.value.revision },
            key: randomUUID(),
          });
        await call(catalog + '/' + suite.id, { user: null, status: 404 });
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
    'disposable suites are deleted and test-account erasure is accepted with access denied; existing staff and content are preserved'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
