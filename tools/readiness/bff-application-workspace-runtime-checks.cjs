const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const {
  readFileSync,
  writeFileSync,
  renameSync,
  statSync,
} = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const sharp = require('sharp');
const execute = promisify(execFile);
const base = '/api/me/application-drafts';
const media = '/api/me/application-images';
const reviews = '/api/editorial/application-reviews';
const claims = '/api/me/ownership-claims';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE;
  const project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT;
  const zoneFile = process.env.WAPPS_BFF_DNS_ZONE;
  assert.ok(
    compose && project && report && zoneFile && process.env.WAPPS_BFF_ACCOUNTS
  );
  const users = [],
    drafts = [],
    uploads = [],
    checks = [],
    erased = [];
  const stopped = new Set(),
    cleanupErrors = [];
  let failure, claim, applicationId, editingDraft, publicPath, dns;
  const persist = () => {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          drafts,
          uploads,
          claim,
          applicationId,
          editingDraft,
          dns,
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
    if (binary && response.ok)
      return { response, value: Buffer.from(await response.arrayBuffer()) };
    const text = await response.text();
    return {
      response,
      value:
        text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null,
    };
  }
  async function until(read, label) {
    let last;
    for (let i = 0; i < 90; i++) {
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
    // The local DNS sidecar shares Editorial's network namespace and must rejoin after restart.
    if (action === 'start' && name === 'editorial')
      await service('restart', 'ownership-dns');
  }
  const command = (
    path,
    body,
    {
      method = 'POST',
      status = method === 'POST' ? 201 : 200,
      key = randomUUID(),
      user = users[0],
      headers,
    } = {}
  ) =>
    call(path, { body, method, key, user, headers, status }).then(
      (r) => r.value
    );
  const read = (path, user = users[0]) =>
    call(path, { user }).then((r) => r.value);
  const editing = (source) => ({
    applicationId: source.applicationId,
    claimId: source.claimId,
    sourcePublicationRevision: source.sourcePublicationRevision,
  });
  async function create(fields, user = users[0], key = randomUUID()) {
    const result = await command(base, fields, { user, key });
    drafts.push({ id: result.id, uid: user.uid });
    persist();
    return result;
  }
  async function reserve(draftId, bytes, purpose = 'logo', user = users[0]) {
    const result = await command(
      media,
      {
        draftId,
        purpose,
        source: {
          contentType: 'image/png',
          bytes: bytes.length,
          sha256: digest(bytes),
        },
      },
      { user }
    );
    uploads.push({ id: result.id, uid: user.uid });
    persist();
    return result;
  }
  const upload = (
    id,
    bytes,
    key = randomUUID(),
    user = users[0],
    status = 200
  ) =>
    command(`${media}/${id}/content`, bytes, {
      method: 'PUT',
      key,
      user,
      status,
      headers: { 'If-Match': '"1"' },
    });
  async function attach(id, imageId, user = users[0], purpose = 'logo') {
    const draft = await read(`${base}/${id}`, user);
    return command(
      `${base}/${id}/images`,
      { expectedRevision: draft.revision, imageId, purpose },
      { method: 'PUT', user }
    );
  }
  async function preview(path, asset, user = users[0]) {
    const { response, value } = await call(path, { user, binary: true });
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(Number(response.headers.get('content-length')), asset.bytes);
    assert.equal(value.length, asset.bytes);
    assert.equal(digest(value), asset.sha256);
    return value;
  }
  function changeDns(remove = false) {
    const zone = JSON.parse(readFileSync(zoneFile, 'utf8'));
    if (remove) {
      assert.equal(
        zone[dns.name],
        dns.value,
        'Disposable DNS record changed unexpectedly'
      );
      delete zone[dns.name];
    } else {
      assert.equal(
        zone[dns.name],
        undefined,
        'Refuse to overwrite an existing DNS record'
      );
      zone[dns.name] = dns.value;
    }
    const temporary = zoneFile + '.' + randomUUID() + '.tmp';
    writeFileSync(temporary, JSON.stringify(zone), {
      mode: statSync(zoneFile).mode & 0o777,
    });
    renameSync(temporary, zoneFile);
  }
  try {
    const existing = JSON.parse(
      readFileSync(process.env.WAPPS_BFF_ACCOUNTS, 'utf8')
    );
    const staff = await command(
      '/auth/signin',
      { email: existing.staff.email, password: existing.staff.password },
      { user: null, status: 200 }
    );
    assert.equal(staff.uid, existing.staff.uid);
    for (const nickname of ['BFF Draft Author', 'BFF Verified Owner']) {
      const user = {
        email: 'bff-draft-' + randomUUID() + '@wapps-review.test',
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
    const [author, other] = users;
    const suffix = randomUUID();
    const fields = {
      name: 'BFF workspace ' + suffix.slice(0, 8),
      slug: 'bff-workspace-' + suffix,
      website: 'https://bff-' + suffix + '.example.test',
      description: 'Disposable application for BFF workspace qualification.',
      classification: 'general',
    };
    const createKey = randomUUID();
    const created = await create(fields, author, createKey);
    const path = `${base}/${created.id}`;
    assert.deepEqual(await command(base, fields, { key: createKey }), created);
    const initial = await read(path);
    assert.deepEqual(
      Object.fromEntries(Object.keys(fields).map((k) => [k, initial[k]])),
      fields
    );
    assert.ok((await read(base)).some((d) => d.id === created.id));
    const updatedFields = {
      ...fields,
      description: fields.description + ' Updated and persisted.',
    };
    const updateBody = { ...updatedFields, expectedRevision: 1 },
      updateKey = randomUUID();
    const updated = await command(path, updateBody, {
      method: 'PUT',
      key: updateKey,
    });
    assert.equal(updated.revision, 2);
    assert.deepEqual(
      await command(path, updateBody, { method: 'PUT', key: updateKey }),
      updated
    );
    await command(path, updateBody, { method: 'PUT', status: 409 });
    const independent = await command(
      '/auth/signin',
      { email: author.email, password: author.password },
      { user: null, status: 200 }
    );
    assert.equal(
      (await read(path, independent)).description,
      updatedFields.description
    );
    for (const user of [null, other]) {
      await call(path, { user, status: user ? 404 : 401 });
      await command(
        path,
        { ...updatedFields, expectedRevision: 2 },
        { user, method: 'PUT', status: user ? 404 : 401 }
      );
    }
    await call(path, {
      user: other,
      headers: {
        'X-User-Id': author.uid,
        'X-User-Claims': '{"roles":["staff"],"tenantId":"default"}',
      },
      status: 404,
    });
    await call(base + '?owner=' + author.uid, { status: 400 });
    await command(
      base,
      { ...fields, ownerIdentityId: other.uid },
      { status: 400 }
    );
    pass(
      'draft CRUD contracts, independent sessions, ownership, forged headers, strict inputs, revision conflicts and retained-key replay'
    );

    const bytes = await sharp({
      create: { width: 80, height: 40, channels: 3, background: 'green' },
    })
      .png()
      .toBuffer();
    const replacement = await sharp({
      create: { width: 90, height: 50, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const first = await reserve(created.id, bytes),
      uploadKey = randomUUID();
    await upload(first.id, bytes, randomUUID(), other, 404);
    await upload(
      first.id,
      Buffer.alloc(bytes.length),
      randomUUID(),
      author,
      400
    );
    const readyReceipt = await upload(first.id, bytes, uploadKey);
    assert.equal(readyReceipt.status, 'ready');
    assert.equal(readyReceipt.revision, 2);
    assert.deepEqual(await upload(first.id, bytes, uploadKey), readyReceipt);
    const ready = await read(`${media}/${first.id}`);
    assert.equal(ready.source.sha256, digest(bytes));
    assert.equal(ready.asset.contentType, 'image/webp');
    assert.equal((await read(`${media}?draftId=${created.id}`)).length, 1);
    await preview(`${media}/${first.id}/content`, ready.asset);
    await attach(created.id, first.id);
    assert.deepEqual(
      (await read(path, independent)).images.logo.asset,
      ready.asset
    );
    await preview(path + '/images/logo/content', ready.asset, independent);
    await call(path + '/images/logo/content', { user: other, status: 404 });
    await command(
      `${media}/${first.id}`,
      { expectedRevision: 2 },
      { method: 'DELETE', status: 409 }
    );
    pass(
      'image reservation, exact source upload, normalized bytes, private previews, attachment/reload and referenced-cancellation conflict'
    );

    const unused = await reserve(created.id, replacement, 'banner'),
      unusedKey = randomUUID();
    const unusedReady = await upload(unused.id, replacement, unusedKey);
    await attach(created.id, unused.id, author, 'banner');
    await attach(created.id, null, author, 'banner');
    const cancelKey = randomUUID(),
      cancelBody = { expectedRevision: 2 };
    const cancelled = await command(`${media}/${unused.id}`, cancelBody, {
      method: 'DELETE',
      key: cancelKey,
    });
    assert.deepEqual(
      await command(`${media}/${unused.id}`, cancelBody, {
        method: 'DELETE',
        key: cancelKey,
      }),
      cancelled
    );
    assert.deepEqual(
      await upload(unused.id, replacement, unusedKey),
      unusedReady
    );
    assert.equal((await read(`${media}/${unused.id}`)).status, 'cancelled');
    await call(`${media}/${unused.id}/content`, { status: 400 });
    assert.ok(
      !(await read(`${media}?draftId=${created.id}`)).some(
        (i) => i.id === unused.id
      )
    );
    pass(
      'slot removal and upload cancellation retain historical receipts without restoring cancelled bytes or list entries'
    );

    const pending = await reserve(created.id, replacement, 'banner'),
      pendingKey = randomUUID();
    await service('stop', 'minio');
    await call(path + '/images/logo/content', { status: 503 });
    await upload(pending.id, replacement, pendingKey, author, 503);
    const textDuringOutage = await read(path);
    await command(
      path,
      { ...updatedFields, expectedRevision: textDuringOutage.revision },
      { method: 'PUT' }
    );
    await service('start', 'minio');
    await until(
      () => preview(path + '/images/logo/content', ready.asset),
      'Image store did not recover'
    );
    await until(
      () => upload(pending.id, replacement, pendingKey),
      'Original upload did not recover after object-store outage'
    );
    assert.equal((await read(`${media}/${pending.id}`)).revision, 2);
    pass(
      'object-store outage leaves text editing usable, fails image operations explicitly, and retained-key retry recovers one ready upload'
    );

    // Publication and ownership fixture commands use the same BFF boundary as draft/image operations.
    const submissionRevision = (await read(path)).revision;
    await command(path + '/submit', { expectedRevision: submissionRevision });
    const frozen =
      path + `/submissions/${submissionRevision}/images/logo/content`;
    const reviewPreview = `${reviews}/${created.id}/submissions/${submissionRevision}/images/logo/content`;
    await preview(frozen, ready.asset);
    await preview(reviewPreview, ready.asset, staff);
    await call(reviewPreview, { status: 403 });
    await attach(created.id, null);
    await call(path + '/images/logo/content', { status: 404 });
    await preview(frozen, ready.asset);
    await command(
      `${reviews}/${created.id}/decision`,
      {
        decision: 'approve',
        expectedRevision: (await read(path)).revision,
        submittedRevision: submissionRevision,
      },
      { user: staff }
    );
    applicationId = created.id;
    publicPath = `/api/media/applications/${applicationId}/logo/${first.id}`;
    persist();
    await preview(publicPath, ready.asset, null);
    await call(
      `/api/media/applications/${applicationId}/banner/${pending.id}`,
      { user: null, status: 404 }
    );
    pass(
      'owner and staff previews preserve frozen submission images; public previews require the current canonical image reference'
    );

    await service('restart', 'ownership-dns');
    const claimReceipt = await command(
      claims,
      {
        applicationId,
        evidenceUrl: fields.website,
        notes: 'Disposable BFF qualification ownership proof.',
      },
      { user: other }
    );
    claim = { id: claimReceipt.id, uid: other.uid };
    persist();
    const challenge = await read(claims + '/' + claim.id, other);
    dns = { name: challenge.challengeName, value: challenge.challengeValue };
    persist();
    changeDns();
    const verified = await command(
      `${claims}/${claim.id}/verify`,
      { expectedRevision: challenge.revision },
      { user: other }
    );
    assert.equal(verified.proofMatched, true);
    await command(
      `/api/editorial/ownership-reviews/${claim.id}/decision`,
      {
        decision: 'approve',
        expectedRevision: verified.revision,
        reason: 'Disposable independent staff review.',
      },
      { user: staff }
    );
    const sourcePath = `${base}/canonical/${applicationId}`;
    const source = await read(sourcePath, other);
    await call(sourcePath, { status: [403, 404] });
    await preview(sourcePath + '/images/logo/content', ready.asset, other);
    await call(sourcePath + '/images/logo/content', { status: 404 });
    const openBody = { editing: editing(source), fields: source.fields },
      openKey = randomUUID();
    const opened = await command(base + '/from-application', openBody, {
      user: other,
      key: openKey,
    });
    editingDraft = opened.id;
    drafts.push({ id: opened.id, uid: other.uid });
    persist();
    assert.deepEqual(
      await command(base + '/from-application', openBody, {
        user: other,
        key: openKey,
      }),
      opened
    );
    const openedPath = `${base}/${opened.id}`;
    await preview(openedPath + '/images/logo/content', ready.asset, other);
    const newImage = await reserve(opened.id, replacement, 'logo', other);
    await upload(newImage.id, replacement, randomUUID(), other);
    await attach(opened.id, newImage.id, other);
    const privateImage = (await read(`${media}/${newImage.id}`, other)).asset;
    const rebaseBody = {
      editing: editing(source),
      fields: {
        ...source.fields,
        description:
          'Private merged description must stay private until independent approval.',
      },
      expectedRevision: 2,
      imageChoices: { logo: 'draft', banner: 'canonical' },
    };
    const rebaseKey = randomUUID();
    const rebased = await command(openedPath + '/rebase', rebaseBody, {
      user: other,
      key: rebaseKey,
    });
    assert.equal(rebased.revision, 3);
    assert.deepEqual(
      await command(openedPath + '/rebase', rebaseBody, {
        user: other,
        key: rebaseKey,
      }),
      rebased
    );
    assert.deepEqual(
      (await read(openedPath, other)).images.logo.asset,
      privateImage
    );
    await preview(openedPath + '/images/logo/content', privateImage, other);
    assert.deepEqual(await read(sourcePath, other), source);
    await preview(publicPath, ready.asset, null);
    await command(
      openedPath + '/rebase',
      {
        ...rebaseBody,
        expectedRevision: 3,
        editing: {
          ...editing(source),
          sourcePublicationRevision: source.sourcePublicationRevision + 1,
        },
      },
      { user: other, status: 409 }
    );
    pass(
      'domain proof and staff grant authorize canonical import/rebase; image merge choices and private fields persist without changing public bytes'
    );

    const routes = [
      [base, author],
      [base.toUpperCase() + '/', author],
      [path, author],
      [sourcePath, other],
      [openedPath, other],
      [`${media}?draftId=${created.id}`, author],
      [`${media}/${first.id}`, author],
      [`/api/me/Application-Images/${first.id}/content/`, author],
      [frozen, author],
      [reviewPreview, staff],
      [reviewPreview.toUpperCase() + '/', staff],
      [publicPath, null],
      [publicPath.toUpperCase() + '/', null],
      [path + '/unknown', author],
    ];
    const saved = await read(openedPath, other);
    await service('stop', 'catalog-bff');
    for (const [route, user] of routes)
      await call(route, { user, status: [502, 504] });
    await command(openedPath + '/rebase', rebaseBody, {
      user: other,
      key: rebaseKey,
      status: [502, 504],
    });
    await upload(first.id, bytes, uploadKey, author, [502, 504]);
    await call('/api/me/articles', { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await until(() => read(base), 'BFF did not recover');
    assert.deepEqual(await read(openedPath, other), saved);
    assert.deepEqual(
      await command(openedPath + '/rebase', rebaseBody, {
        user: other,
        key: rebaseKey,
      }),
      rebased
    );
    await preview(publicPath, ready.asset, null);
    pass(
      'draft, upload and all preview families require BFF including case/slash variants; restart preserves bytes, revisions and receipts'
    );

    await service('stop', 'editorial');
    for (const [route, user] of routes.filter(
      ([route]) => !route.includes('unknown') && route === route.toLowerCase()
    ))
      await call(route, { user, status: 503 });
    await upload(first.id, bytes, uploadKey, author, 503);
    await command(openedPath + '/rebase', rebaseBody, {
      user: other,
      key: rebaseKey,
      status: 503,
    });
    await call('/api/me/profile');
    await service('start', 'editorial');
    await until(() => read(base), 'Editorial did not recover');
    assert.deepEqual(await read(openedPath, other), saved);
    assert.deepEqual(await upload(first.id, bytes, uploadKey), readyReceipt);
    await preview(publicPath, ready.asset, null);
    pass(
      'Editorial outage returns safe errors; restart and original-key retries preserve draft and image state'
    );

    const withdrawal = await command(
      openedPath + '/withdraw',
      { expectedRevision: saved.revision },
      { user: other }
    );
    assert.ok(
      withdrawal.publicationRevision > source.sourcePublicationRevision
    );
    await call(publicPath, { user: null, status: 404 });
    assert.deepEqual(await upload(first.id, bytes, uploadKey), readyReceipt);
    await call(publicPath, { user: null, status: 404 });
    pass(
      'withdrawal removes public image access immediately; historical upload replay cannot republish it'
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
    try {
      await until(() => call(base), 'Services did not recover for cleanup');
      if (applicationId) {
        let target = editingDraft ?? applicationId,
          owner = editingDraft ? users[1] : users[0];
        if (
          claim &&
          !editingDraft &&
          (await read(`${claims}/${claim.id}`, users[1])).status === 'approved'
        ) {
          const source = await read(
            `${base}/canonical/${applicationId}`,
            users[1]
          );
          const opened = await command(
            base + '/from-application',
            { editing: editing(source), fields: source.fields },
            { user: users[1] }
          );
          drafts.push({ id: opened.id, uid: users[1].uid });
          target = opened.id;
          owner = users[1];
          persist();
        }
        const state = await read(`${base}/${target}/publication`, owner);
        if (
          state.publicSlug !== null ||
          state.latestSubmission?.status === 'submitted'
        )
          await command(
            `${base}/${target}/withdraw`,
            { expectedRevision: state.revision },
            { user: owner }
          );
        if (publicPath) await call(publicPath, { user: null, status: 404 });
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
    for (const draft of [...drafts].reverse())
      try {
        const user = users.find((u) => u.uid === draft.uid);
        const current = await call(`${base}/${draft.id}`, {
          user,
          status: [200, 404],
        });
        if (current.response.status === 200) {
          const body = { expectedRevision: current.value.revision },
            key = randomUUID();
          const deleted = await command(`${base}/${draft.id}`, body, {
            method: 'DELETE',
            user,
            key,
          });
          assert.equal(deleted.deleted, true);
          assert.deepEqual(
            await command(`${base}/${draft.id}`, body, {
              method: 'DELETE',
              user,
              key,
            }),
            deleted
          );
        }
        await call(`${base}/${draft.id}`, { user, status: 404 });
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (claim)
      try {
        const user = users.find((u) => u.uid === claim.uid),
          state = await read(`${claims}/${claim.id}`, user);
        if (
          ['approved', 'awaiting-proof', 'awaiting-review'].includes(
            state.status
          )
        )
          await command(
            `${claims}/${claim.id}/${
              state.status === 'approved' ? 'release' : 'cancel'
            }`,
            { expectedRevision: state.revision },
            { user }
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (dns)
      try {
        changeDns(true);
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
        ? 'Workspace cleanup incomplete; use recovery records'
        : 'Workspace qualification failed'
    );
  pass(
    'disposable publication withdrawn, drafts deleted with replay, grant/DNS fixture removed and account erasure accepted; existing content preserved'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
