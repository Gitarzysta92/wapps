const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('sharp');
const execute = promisify(execFile);
const drafts = '/api/me/articles',
  reviews = '/api/editorial/article-reviews',
  covers = '/api/me/article-covers';

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE,
    project = process.env.WAPPS_BFF_COMPOSE_PROJECT,
    report = process.env.WAPPS_BFF_REPORT;
  assert.ok(compose && project && report && process.env.WAPPS_BFF_ACCOUNTS);
  assert.ok(
    !existsSync(report) && !existsSync(report + '.accounts.json'),
    'Use a fresh evidence path'
  );
  const users = [],
    articles = [],
    uploads = [],
    checks = [],
    erased = [],
    cleanupErrors = [],
    stopped = new Set();
  let staff, failure;
  function persist() {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          articles,
          uploads,
          erased,
          disposableIdentities: users.map((u) => u.uid),
          failure: failure?.message,
          cleanupErrors: cleanupErrors.map((e) => e.message),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  }
  function pass(name) {
    checks.push(name);
    persist();
    console.log('PASS ' + name);
  }
  async function call(
    path,
    {
      user = users[0],
      method = 'GET',
      body,
      key,
      headers = {},
      status = 200,
      binary = false,
    } = {}
  ) {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
        ...(body === undefined
          ? {}
          : {
              'Content-Type': Buffer.isBuffer(body)
                ? 'application/octet-stream'
                : 'application/json',
            }),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(70000),
    });
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: HTTP ${response.status}, expected ${status}`
    );
    if (response.ok && path.startsWith('/api/'))
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
    if (binary && response.ok) {
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(
        response.headers.get('content-security-policy')?.includes('sandbox')
      );
      return { response, value: Buffer.from(await response.arrayBuffer()) };
    }
    const text = await response.text();
    return {
      response,
      value:
        text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null,
    };
  }
  const read = (path, user = users[0]) =>
    call(path, { user }).then((r) => r.value);
  const command = (
    path,
    body,
    {
      user = users[0],
      method = 'POST',
      key = randomUUID(),
      status = method === 'POST' ? 201 : 200,
      ...options
    } = {}
  ) =>
    call(path, { ...options, user, method, key, body, status }).then(
      (r) => r.value
    );
  async function until(readValue, label) {
    let last;
    for (let i = 0; i < 80; i++) {
      try {
        return await readValue();
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
    if (['start', 'restart'].includes(action) && name === 'editorial')
      await service('restart', 'ownership-dns');
  }
  async function create(fields, user = users[0], key = randomUUID()) {
    const receipt = await command(drafts, fields, { user, key });
    if (!articles.some((a) => a.id === receipt.id))
      articles.push({ id: receipt.id, slug: fields.slug, owner: user.uid });
    persist();
    return receipt;
  }
  const owner = (id) => {
    const article = articles.find((a) => a.id === id);
    assert.ok(article, 'Only this run owns fixture mutation');
    const user = [staff, ...users].find((u) => u.uid === article.owner);
    assert.ok(user);
    return user;
  };
  async function update(id, fields, options = {}) {
    const user = owner(id),
      current = await read(`${drafts}/${id}`, user);
    return command(
      `${drafts}/${id}`,
      { ...fields, expectedRevision: current.revision },
      { method: 'PUT', user, ...options }
    );
  }
  async function publication(id, action, options = {}) {
    const user = owner(id),
      state = await read(`${drafts}/${id}/publication`, user);
    const review = action === 'approve' || action === 'reject';
    const body = {
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
      ...(review
        ? {
            decision: action,
            submittedRevision: state.latestSubmission.submittedRevision,
            reason: 'Independent article review.',
          }
        : {}),
    };
    const path = review
        ? `${reviews}/${id}/decision`
        : `${drafts}/${id}/${action}`,
      key = randomUUID();
    const result = await command(path, body, {
      user: review ? staff : user,
      key,
      ...options,
    });
    return { path, body, key, result };
  }
  async function reserve(articleId, bytes, contentType = 'image/png') {
    const result = await command(covers, {
      articleId,
      source: {
        contentType,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
    });
    uploads.push({ id: result.id, articleId });
    persist();
    return result;
  }
  async function upload(reservation, bytes, options = {}) {
    const key = randomUUID(),
      path = `${covers}/${reservation.id}/content`;
    const headers = { 'If-Match': `"${reservation.revision}"` };
    const result = await command(path, bytes, {
      method: 'PUT',
      key,
      headers,
      ...options,
    });
    return { path, headers, key, result };
  }
  const cover = (path, user = users[0]) =>
    call(path, { user, binary: true }).then((r) => r.value);
  async function projection(id) {
    owner(id);
    // Observe only this run's projection; database credentials stay inside Editorial.
    const script = `const {MongoClient}=require('mongodb');(async()=>{const e=process.env;const c=new MongoClient('mongodb://'+encodeURIComponent(e.MONGO_USERNAME)+':'+encodeURIComponent(e.MONGO_PASSWORD)+'@'+e.MONGO_HOST+':'+e.MONGO_PORT,{serverSelectionTimeoutMS:3000});try{await c.connect();const p=await c.db(e.MONGO_DATABASE).collection('editorial_projections_v1').findOne({kind:'article',resourceId:process.argv[1]},{projection:{_id:0,revision:1,deletedAt:1}});console.log(JSON.stringify(p));}finally{await c.close();}})().catch(()=>{console.error('Projection observation failed');process.exitCode=1;});`;
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
    staff = await command(
      '/auth/signin',
      { email: existing.staff.email, password: existing.staff.password },
      { user: null, status: 200 }
    );
    assert.equal(staff.uid, existing.staff.uid);
    for (const nickname of ['BFF Article Author', 'BFF Article Stranger']) {
      const user = {
        email: 'bff-article-' + randomUUID() + '@wapps-review.test',
        password: randomUUID() + '!Aa1',
        nickname,
        registrationKey: randomUUID(),
      };
      users.push(user);
      persist();
      Object.assign(
        user,
        await command(
          '/auth/register',
          {
            email: user.email,
            password: user.password,
            passwordConfirmation: user.password,
            nickname,
          },
          { user: null, key: user.registrationKey, status: 200 }
        )
      );
      assert.ok(user.uid && user.token);
      persist();
    }
    const fields = {
      title: 'BFF Article ' + randomUUID(),
      slug: 'bff-article-' + randomUUID(),
      excerpt: 'Article workflow through the BFF.',
      byline: 'Disposable public author',
      category: 'Guides',
      tags: ['bff-article'],
      classification: 'general',
      sections: [
        { heading: 'First section', paragraphs: ['Complete article body.'] },
      ],
    };
    const createKey = randomUUID(),
      created = await create(fields, users[0], createKey),
      id = created.id;
    assert.equal(created.revision, 1);
    assert.deepEqual(await create(fields, users[0], createKey), created);
    await command(
      drafts,
      { ...fields, title: 'Changed key payload' },
      { key: createKey, status: 409 }
    );
    const publicPath = '/api/catalog/articles/' + fields.slug;
    const independent = await command(
      '/auth/signin',
      { email: users[0].email, password: users[0].password },
      { user: null, status: 200 }
    );
    assert.equal(
      (await read(`${drafts}/${id}`, independent)).title,
      fields.title
    );
    assert.ok((await read(drafts)).some((a) => a.id === id));
    assert.deepEqual(await read(drafts, users[1]), []);
    for (const path of [`${drafts}/${id}`, `${drafts}/${id}/publication`])
      await call(path, { user: users[1], status: [403, 404] });
    await call(drafts, {
      user: null,
      headers: { 'X-User-Id': users[0].uid, 'X-Ingress-Auth': 'forged' },
      status: 401,
    });
    await call(reviews, { status: 403 });
    await call(`${reviews}/${id}`, { status: 403 });
    await call(publicPath, { user: null, status: 404 });
    const large = {
      ...fields,
      sections: [
        { heading: '', paragraphs: Array(6).fill('\u754c'.repeat(3900)) },
      ],
    };
    assert.ok(Buffer.byteLength(JSON.stringify(large)) > 64 * 1024);
    const largeReceipt = await update(id, large);
    assert.equal(
      (await read(`${drafts}/${id}`)).sections[0].paragraphs[0],
      large.sections[0].paragraphs[0]
    );
    await command(
      `${drafts}/${id}`,
      { ...fields, expectedRevision: 1 },
      { method: 'PUT', status: 409 }
    );
    assert.equal(largeReceipt.revision, 2);
    await update(id, fields);
    pass(
      'private authoring, independent sign-in, owner isolation, spoofing denial, strict revisions/keys and multilingual article bodies above 64 KiB'
    );

    const bytes1 = await sharp({
      create: { width: 320, height: 180, channels: 3, background: 'green' },
    })
      .png()
      .toBuffer();
    const bytes2 = await sharp({
      create: { width: 320, height: 180, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const first = await reserve(id, bytes1);
    await call(`${covers}/${first.id}`, { user: users[1], status: [403, 404] });
    await call(`${covers}/${first.id}/content`, {
      user: users[1],
      method: 'PUT',
      body: bytes1,
      key: randomUUID(),
      headers: { 'If-Match': '"1"' },
      status: [403, 404],
    });
    await command(
      covers,
      {
        articleId: id,
        source: {
          contentType: 'image/svg+xml',
          bytes: 10,
          sha256: 'a'.repeat(64),
        },
      },
      { status: 400 }
    );
    await upload(first, Buffer.alloc(bytes1.length), { status: 400 });
    await upload({ ...first, revision: 9 }, bytes1, { status: 409 });
    const upload1 = await upload(first, bytes1);
    assert.equal(upload1.result.status, 'ready');
    const normalized1 = await cover(upload1.path);
    assert.equal((await sharp(normalized1).metadata()).format, 'webp');
    assert.deepEqual(
      await command(upload1.path, bytes1, {
        method: 'PUT',
        key: upload1.key,
        headers: upload1.headers,
      }),
      upload1.result
    );
    assert.ok(
      (await read(covers + '?articleId=' + id)).some((i) => i.id === first.id)
    );
    const cancelled = await reserve(id, bytes1),
      cancelKey = randomUUID(),
      cancelBody = { expectedRevision: 1 };
    const cancellation = await command(
      `${covers}/${cancelled.id}`,
      cancelBody,
      { method: 'DELETE', key: cancelKey }
    );
    assert.deepEqual(
      await command(`${covers}/${cancelled.id}`, cancelBody, {
        method: 'DELETE',
        key: cancelKey,
      }),
      cancellation
    );
    await call(`${covers}/${cancelled.id}/content`, { status: 400 });
    assert.ok(
      !(await read(covers + '?articleId=' + id)).some(
        (i) => i.id === cancelled.id
      )
    );
    const withFirst = {
      ...fields,
      cover: { imageId: first.id, alt: 'Reviewed green cover' },
    };
    await update(id, withFirst);
    await command(
      `${covers}/${first.id}`,
      { expectedRevision: upload1.result.revision },
      { method: 'DELETE', status: 409 }
    );
    pass(
      'private cover reservation, real PNG normalization, protected preview, exact bytes/revisions, upload and cancellation replay, and referenced-cover retention'
    );

    const submitted = await publication(id, 'submit'),
      submittedRevision = submitted.result.submittedRevision;
    await publication(id, 'submit', { status: 409 });
    await command(
      `${drafts}/${id}`,
      { expectedRevision: submitted.result.revision },
      { method: 'DELETE', status: 409 }
    );
    const second = await reserve(id, bytes2),
      upload2 = await upload(second, bytes2),
      normalized2 = await cover(upload2.path);
    const edited = {
      ...fields,
      title: fields.title + ' edited',
      cover: { imageId: second.id, alt: 'Reviewed blue cover' },
    };
    await update(id, edited);
    const review = await read(`${reviews}/${id}`, staff);
    assert.equal(review.latestSubmission.title, fields.title);
    assert.equal(review.latestSubmission.cover.imageId, first.id);
    assert.equal(review.latestSubmission.classification, 'general');
    assert.ok((await read(reviews, staff)).items.some((a) => a.id === id));
    const frozenOwner = `${drafts}/${id}/submissions/${submittedRevision}/cover`,
      frozenStaff = `${reviews}/${id}/submissions/${submittedRevision}/cover`;
    assert.deepEqual(await cover(frozenOwner), normalized1);
    assert.deepEqual(await cover(frozenStaff, staff), normalized1);
    await call(frozenOwner, { user: users[1], status: [403, 404] });
    await call(frozenStaff, { status: 403 });
    await call(`${reviews}/${id}/submissions/99999/cover`, {
      user: staff,
      status: 404,
    });
    await publication(id, 'reject');
    assert.equal(
      (await read(`${drafts}/${id}/publication`)).latestSubmission.status,
      'rejected'
    );
    const resubmitted = await publication(id, 'submit');
    await call(frozenOwner, { status: 404 });
    assert.deepEqual(
      await cover(
        `${reviews}/${id}/submissions/${resubmitted.result.submittedRevision}/cover`,
        staff
      ),
      normalized2
    );
    const self = await create(
      { ...fields, slug: 'bff-staff-article-' + randomUUID() },
      staff
    );
    await publication(self.id, 'submit');
    await publication(self.id, 'approve', { status: 403 });
    await call(`${reviews}/${self.id}`, { user: staff, status: 403 });
    assert.ok(
      !(await read(reviews, staff)).items.some((a) => a.id === self.id)
    );
    await publication(self.id, 'withdraw');
    pass(
      'immutable submitted text/classification/cover, owner and staff previews, later private edits, rejection/resubmission and live staff self-review denial'
    );

    await service('stop', 'editorial-materializer');
    const approved = await publication(id, 'approve');
    assert.equal(approved.result.publicationRevision, 1);
    await call(publicPath, { user: null, status: 503 });
    const publicCover1 = `/api/media/articles/${id}/${first.id}`,
      publicCover2 = `/api/media/articles/${id}/${second.id}`;
    assert.deepEqual(await cover(publicCover2, null), normalized2);
    await call(publicCover1, { user: null, status: 404 });
    await service('start', 'editorial-materializer');
    await until(
      async () => assert.equal((await read(publicPath, null)).revision, 1),
      'Article publication did not converge'
    );
    const published = await read(publicPath, null);
    assert.equal(published.title, edited.title);
    assert.equal(published.cover.imageId, second.id);
    for (const key of [
      'ownerIdentityId',
      'tenantId',
      'reviewerIdentityId',
      'latestSubmission',
    ])
      assert.equal(published[key], undefined);
    const listing = await read(
      '/api/catalog/articles?' +
        new URLSearchParams({
          q: fields.title.toUpperCase(),
          category: fields.category,
          tag: 'bff-article',
          page: '1',
          pageSize: '3',
          sort: 'name-desc',
        }),
      null
    );
    assert.equal(listing.pageSize, 3);
    assert.equal(listing.total, 1);
    assert.equal(listing.items[0].id, id);
    assert.equal(listing.items[0].sections, undefined);
    assert.equal(
      (await read('/api/catalog/article-selection?ids=' + id, null)).items[0]
        .id,
      id
    );
    const visibility = await read(
      '/api/catalog/article-visibility/' + id,
      null
    );
    assert.equal(visibility.id, id);
    assert.equal(visibility.revision, 1);
    await update(
      id,
      { ...edited, slug: 'renamed-' + randomUUID() },
      { status: 409 }
    );
    const duplicate = await create(fields);
    await publication(duplicate.id, 'submit');
    await publication(duplicate.id, 'approve', { status: 409 });
    await publication(duplicate.id, 'withdraw');
    pass(
      'independent approval, lag returns 503, canonical public cover access, exact public fields, browse/search/page size/selection/visibility and immutable unique slugs'
    );

    await service('stop', 'minio');
    await call(publicCover2, { user: null, status: 503 });
    await call(upload2.path, { status: 503 });
    assert.equal((await read(`${drafts}/${id}`)).title, edited.title);
    await service('start', 'minio');
    await until(
      async () =>
        assert.deepEqual(await cover(publicCover2, null), normalized2),
      'Object store did not recover'
    );
    await service('stop', 'mongodb');
    await call(publicPath, { user: null, status: 503 });
    assert.equal((await read(`${drafts}/${id}/publication`)).visible, true);
    assert.deepEqual(await cover(publicCover2, null), normalized2);
    await service('start', 'mongodb');
    await until(() => read(publicPath, null), 'Mongo did not recover');
    pass(
      'object-store failure remains an unavailable media response; Mongo failure does not substitute public text or decide canonical media authorization'
    );

    await service('stop', 'catalog-bff');
    const unavailablePaths = [
      drafts,
      `${drafts}/${id}`,
      reviews,
      `${reviews}/${id}`,
      covers + '?articleId=' + id,
      upload2.path,
      publicPath,
      '/api/catalog/article-selection?ids=' + id,
      '/api/catalog/article-visibility/' + id,
      publicCover2,
      '/api/ME/ARTICLES/',
      `/api/ME/ARTICLE-COVERS/${second.id}/CONTENT/`,
      `/api/EDITORIAL/ARTICLE-REVIEWS/${id}/SUBMISSIONS/${resubmitted.result.submittedRevision}/COVER/`,
      `/api/MEDIA/ARTICLES/${id}/${second.id}/`,
      `${drafts}/${id}/unknown`,
      `${covers}/${second.id}/unknown`,
    ];
    await Promise.all(
      unavailablePaths.map((path) =>
        call(path, { user: staff, status: [502, 503, 504] })
      )
    );
    await service('start', 'catalog-bff');
    await until(() => read(drafts), 'BFF did not recover');
    assert.equal((await read(`${drafts}/${id}`)).cover.imageId, second.id);
    assert.deepEqual(
      await command(approved.path, approved.body, {
        user: staff,
        key: approved.key,
      }),
      approved.result
    );
    assert.deepEqual(
      await command(upload2.path, bytes2, {
        method: 'PUT',
        key: upload2.key,
        headers: upload2.headers,
      }),
      upload2.result
    );
    pass(
      'every migrated family including case/slash/unknown variants depends on BFF; restart preserves drafts, publication and exact upload/approval replay'
    );

    await update(id, { ...withFirst, title: fields.title + ' replacement' });
    await publication(id, 'submit');
    await service('stop', 'editorial-materializer');
    const replacement = await publication(id, 'approve');
    assert.equal(replacement.result.publicationRevision, 2);
    assert.equal((await projection(id)).revision, 1);
    await call(publicPath, { user: null, status: 503 });
    await call(publicCover2, { user: null, status: 404 });
    assert.deepEqual(await cover(publicCover1, null), normalized1);
    const withdrawn = await publication(id, 'withdraw');
    assert.equal(withdrawn.result.publicationRevision, 3);
    assert.equal((await projection(id)).revision, 1);
    for (const path of [
      publicPath,
      publicCover1,
      publicCover2,
      '/api/catalog/article-visibility/' + id,
    ])
      await call(path, { user: null, status: 404 });
    assert.deepEqual(
      await read('/api/catalog/article-selection?ids=' + id, null),
      { items: [] }
    );
    await service('stop', 'editorial');
    await call(`${drafts}/${id}`, { status: 503 });
    await call(publicPath, { user: null, status: 503 });
    await call(publicCover1, { user: null, status: 503 });
    await service('start', 'editorial');
    await until(() => read(drafts), 'Editorial did not recover');
    assert.deepEqual(
      await command(replacement.path, replacement.body, {
        user: staff,
        key: replacement.key,
      }),
      replacement.result
    );
    assert.deepEqual(
      await command(withdrawn.path, withdrawn.body, { key: withdrawn.key }),
      withdrawn.result
    );
    await call(publicPath, { user: null, status: 404 });
    await call(publicCover1, { user: null, status: 404 });
    await service('start', 'editorial-materializer');
    await until(async () => {
      const p = await projection(id);
      assert.equal(p.revision, 3);
      assert.notEqual(p.deletedAt, null);
    }, 'Article tombstone did not converge');
    await call(publicPath, { user: null, status: 404 });
    pass(
      'cover replacement and withdrawal use current authority during revision-1 projection lag; Editorial restart and historical replay converge to revision-3 tombstone without resurrection'
    );
  } catch (error) {
    failure = error;
    persist();
  } finally {
    for (const name of [...stopped])
      try {
        await service('start', name);
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (articles.length)
      try {
        await until(
          () => read(drafts),
          'Article API did not recover for cleanup'
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const article of [...articles].reverse())
      try {
        const user = owner(article.id),
          path = `${drafts}/${article.id}`;
        const current = await call(path, { user, status: [200, 404] });
        if (current.response.status === 404) continue;
        const state = await read(path + '/publication', user);
        if (state.visible || state.latestSubmission?.status === 'submitted')
          await publication(article.id, 'withdraw');
        const draft = await read(path, user),
          key = randomUUID(),
          body = { expectedRevision: draft.revision };
        const deleted = await command(path, body, {
          user,
          method: 'DELETE',
          key,
        });
        assert.equal(deleted.deleted, true);
        assert.deepEqual(
          await command(path, body, { user, method: 'DELETE', key }),
          deleted
        );
        await call(path, { user, status: 404 });
        await call('/api/catalog/articles/' + article.slug, {
          user: null,
          status: 404,
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const upload of uploads)
      try {
        await call(`/api/media/articles/${upload.articleId}/${upload.id}`, {
          user: null,
          status: 404,
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const user of cleanupErrors.length ? [] : [...users].reverse())
      if (user.uid)
        try {
          await call('/api/me', { user, method: 'DELETE', status: 202 });
          erased.push(user.uid);
          persist();
          await call(drafts, { user, status: [401, 403] });
        } catch (error) {
          cleanupErrors.push(error);
        }
    persist();
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Article cleanup incomplete; use recovery records'
        : 'Article qualification failed'
    );
  pass(
    'all disposable articles withdrawn/deleted with replay, public covers inaccessible and two erasures accepted; retained audit/media lifecycle and background erasure completion are not bypassed or claimed'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
