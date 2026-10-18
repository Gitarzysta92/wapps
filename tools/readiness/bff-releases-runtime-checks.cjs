const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  readFileSync,
  writeFileSync,
  renameSync,
  statSync,
} = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const execute = promisify(execFile);
const claimsPath = '/api/me/ownership-claims';
const reviews = '/api/editorial/ownership-reviews';
const draftsPath = '/api/me/application-drafts';
const releases = '/api/me/releases';
const releaseReviews = '/api/editorial/release-reviews';
const publicationReviews = '/api/editorial/application-reviews';

async function main() {
  const origin = new URL(process.env.WAPPS_BFF_ORIGIN);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
  assert.equal(origin.protocol, 'http:');
  const compose = process.env.WAPPS_BFF_COMPOSE_FILE,
    project = process.env.WAPPS_BFF_COMPOSE_PROJECT;
  const report = process.env.WAPPS_BFF_REPORT,
    zoneFile = process.env.WAPPS_BFF_DNS_ZONE;
  assert.ok(
    compose && project && report && zoneFile && process.env.WAPPS_BFF_ACCOUNTS
  );
  const users = [],
    claims = [],
    drafts = [],
    releaseDrafts = [],
    checks = [],
    erased = [],
    cleanupErrors = [];
  const stopped = new Set(),
    dns = new Map();
  let staff, applicationId, publicPath, applicationFields, failure;
  const persist = () => {
    writeFileSync(report + '.accounts.json', JSON.stringify(users, null, 2), {
      mode: 0o600,
    });
    writeFileSync(
      report,
      JSON.stringify(
        {
          checks,
          applicationId,
          applicationFields,
          claims,
          drafts,
          releaseDrafts,
          dns: Object.fromEntries(dns),
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
        text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null,
    };
  }
  const read = (path, user = users[0]) =>
    call(path, { user }).then((r) => r.value);
  const command = (
    path,
    body,
    {
      method = 'POST',
      user = users[0],
      key = randomUUID(),
      status = method === 'POST' ? 201 : 200,
      headers,
    } = {}
  ) =>
    call(path, { method, user, key, body, status, headers }).then(
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
  function setDns(name, value) {
    const zone = JSON.parse(readFileSync(zoneFile, 'utf8'));
    assert.equal(
      zone[name],
      dns.get(name),
      'Refuse to overwrite a DNS record outside this run'
    );
    if (value === undefined) {
      delete zone[name];
      dns.delete(name);
    } else {
      zone[name] = value;
      dns.set(name, value);
    }
    const temporary = zoneFile + '.' + randomUUID() + '.tmp';
    writeFileSync(temporary, JSON.stringify(zone), {
      mode: statSync(zoneFile).mode & 0o777,
    });
    renameSync(temporary, zoneFile);
    persist();
  }
  const fields = {
    version: '1.0.0+build_A-2',
    channel: 'stable',
    type: 'minor',
    releasedOn: '2026-01-01',
    title: 'Disposable release notes',
    description: 'Release publication qualification through the real BFF.',
    changes: [{ type: 'feature', description: 'A complete approved release.' }],
  };
  const releasePath = (id) => `${releases}/${id}`;
  const releaseState = (id) => read(releasePath(id) + '/publication');
  const publicRelease = () =>
    `/api/catalog/releases/${applicationFields.slug}/${encodeURIComponent(
      fields.version
    )}`;
  async function createRelease(input, options = {}) {
    const result = await command(releases, input, options);
    if (result?.id && !releaseDrafts.includes(result.id)) {
      releaseDrafts.push(result.id);
      persist();
    }
    return result;
  }
  async function openRelease(releaseId, claimId, revision, options = {}) {
    const body = {
      applicationId,
      claimId,
      releaseId,
      expectedPublicationRevision: revision,
    };
    const result = await command(releases + '/open', body, options);
    if (result?.id && !releaseDrafts.includes(result.id)) {
      releaseDrafts.push(result.id);
      persist();
    }
    return { body, result };
  }
  async function updateRelease(id, content, options = {}) {
    const current = await read(releasePath(id));
    return command(
      releasePath(id),
      { expectedRevision: current.revision, fields: content },
      { method: 'PUT', ...options }
    );
  }
  async function publication(id, action, options = {}) {
    const state = await releaseState(id);
    const review = action === 'approve' || action === 'reject';
    const body = {
      expectedRevision: state.revision,
      expectedPublicationRevision: state.publicationRevision,
      ...(review
        ? {
            decision: action,
            submittedRevision: state.latestSubmission.submittedRevision,
            reason: 'Independent release review.',
          }
        : {}),
    };
    const path = review
      ? `${releaseReviews}/${id}/decision`
      : `${releasePath(id)}/${action}`;
    const key = randomUUID();
    const result = await command(path, body, {
      user: review ? staff : users[0],
      key,
      ...options,
    });
    return { path, body, key, result };
  }
  async function grant() {
    const created = await command(claimsPath, {
      applicationId,
      evidenceUrl: applicationFields.website,
      notes: 'Disposable release owner proof.',
    });
    claims.push(created.id);
    persist();
    let state = await read(`${claimsPath}/${created.id}`);
    setDns(state.challengeName, state.challengeValue);
    await command(`${claimsPath}/${created.id}/verify`, {
      expectedRevision: state.revision,
    });
    state = await read(`${claimsPath}/${created.id}`);
    await command(
      `${reviews}/${created.id}/decision`,
      {
        decision: 'approve',
        expectedRevision: state.revision,
        reason: 'Independent release owner approval.',
      },
      { user: staff }
    );
    return created.id;
  }
  async function projection(releaseId) {
    assert.ok(releaseDrafts.length > 0);
    // Observe only this run's release projection; credentials remain in Editorial.
    assert.ok(releaseIds.has(releaseId));
    const script = `const {MongoClient}=require('mongodb');(async()=>{const e=process.env;const c=new MongoClient('mongodb://'+encodeURIComponent(e.MONGO_USERNAME)+':'+encodeURIComponent(e.MONGO_PASSWORD)+'@'+e.MONGO_HOST+':'+e.MONGO_PORT,{serverSelectionTimeoutMS:3000});try{await c.connect();const p=await c.db(e.MONGO_DATABASE).collection('editorial_projections_v1').findOne({kind:'release',resourceId:process.argv[1]},{projection:{_id:0,revision:1,deletedAt:1}});console.log(JSON.stringify(p));}finally{await c.close();}})().catch(()=>{console.error('Projection observation failed');process.exitCode=1;});`;
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
        releaseId,
      ],
      { timeout: 10000, maxBuffer: 4096 }
    );
    return JSON.parse(result.stdout);
  }
  const releaseIds = new Set();
  async function publicRevision(revision) {
    return until(async () => {
      const value = await read(publicRelease(), null);
      assert.equal(value.revision, revision);
      return value;
    }, 'Release projection did not converge');
  }
  async function hideParent() {
    if (!applicationId) return;
    const visible = await call(publicPath, {
      user: null,
      status: [200, 404, 503],
    });
    if (visible.response.status === 404) return;
    let active;
    for (const claim of claims)
      if ((await read(`${claimsPath}/${claim}`)).status === 'approved')
        active = claim;
    if (!active) active = await grant();
    // The original author's unbound draft reserves the slug but cannot withdraw after a grant exists.
    if (drafts.includes(applicationId)) {
      const original = await call(`${draftsPath}/${applicationId}`, {
        status: [200, 404],
      });
      if (original.response.status === 200)
        await command(
          `${draftsPath}/${applicationId}`,
          { expectedRevision: original.value.revision },
          { method: 'DELETE' }
        );
    }
    const source = await read(`${draftsPath}/canonical/${applicationId}`);
    const imported = await command(draftsPath + '/from-application', {
      editing: {
        applicationId,
        claimId: active,
        sourcePublicationRevision: source.sourcePublicationRevision,
      },
      fields: source.fields,
    });
    drafts.push(imported.id);
    persist();
    await command(`${draftsPath}/${imported.id}/withdraw`, {
      expectedRevision: imported.revision,
    });
    await call(publicPath, { user: null, status: 404 });
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
    for (const nickname of ['BFF Release Author', 'BFF Release Stranger']) {
      const user = {
        email: 'bff-release-' + randomUUID() + '@wapps-review.test',
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
    applicationFields = {
      name: 'BFF Releases ' + randomUUID().slice(0, 8),
      slug: 'bff-releases-' + randomUUID(),
      website: 'https://bff-releases-' + randomUUID() + '.example.test',
      description: 'Disposable release workflow parent.',
      classification: 'general',
    };
    const app = await command(draftsPath, applicationFields);
    applicationId = app.id;
    drafts.push(app.id);
    publicPath = '/api/catalog/apps/' + applicationFields.slug;
    persist();
    await command(`${draftsPath}/${app.id}/submit`, { expectedRevision: 1 });
    await command(
      `${publicationReviews}/${app.id}/decision`,
      { decision: 'approve', expectedRevision: 2, submittedRevision: 1 },
      { user: staff }
    );
    await until(
      () => read(publicPath, null),
      'Parent application did not publish'
    );
    await service('restart', 'ownership-dns');
    const claimId = await grant();
    await until(async () => {
      assert.equal((await read(publicPath, null)).revision, 2);
    }, 'Ownership projection did not converge');
    const source = await read(`${releases}/source/${applicationId}`);
    assert.equal(source.claimId, claimId);
    assert.equal(source.release, null);
    const input = { applicationId, claimId, fields },
      key = randomUUID();
    const created = await createRelease(input, { key }),
      id = created.id;
    const draft = await read(releasePath(id)),
      releaseId = draft.target.releaseId;
    releaseIds.add(releaseId);
    assert.deepEqual(await createRelease(input, { key }), created);
    await command(
      releases,
      { ...input, fields: { ...fields, title: 'Different request' } },
      { key, status: 409 }
    );
    assert.ok((await read(releases)).some((d) => d.id === id));
    for (const user of [null, { token: 'invalid' }])
      await call(releases, { user, status: 401 });
    await call(releasePath(id), { user: users[1], status: 404 });
    await call(releaseReviews, { user: users[0], status: 403 });
    await command(
      `${releaseReviews}/${id}/decision`,
      {
        decision: 'approve',
        expectedRevision: 1,
        expectedPublicationRevision: null,
        submittedRevision: 1,
      },
      { status: 403 }
    );
    await call(releaseReviews, {
      headers: {
        'x-user-id': staff.uid,
        'x-user-claims': '{"roles":["staff"]}',
      },
      status: 403,
    });
    await call(publicRelease(), { user: null, status: 404 });
    pass(
      'claim-bound private creation, canonical source, list/detail, idempotency conflicts, owner isolation and spoofed-role denial through BFF'
    );

    await updateRelease(id, { ...fields, releasedOn: '2999-01-01' });
    await publication(id, 'submit', { status: 400 });
    assert.equal((await read(releasePath(id))).revision, 2);
    await command(
      releasePath(id),
      { expectedRevision: 1, fields },
      { method: 'PUT', status: 409 }
    );
    await updateRelease(id, fields);
    await publication(id, 'submit');
    await updateRelease(id, {
      ...fields,
      title: 'Private edit after submission',
    });
    const pending = await read(`${releaseReviews}/${id}`, staff);
    assert.equal(pending.latestSubmission.title, fields.title);
    assert.equal(pending.revision, 5);
    assert.ok(
      (await read(releaseReviews, staff)).items.some((d) => d.id === id)
    );
    await command(
      `${releaseReviews}/${id}/decision`,
      {
        decision: 'reject',
        expectedRevision: pending.revision,
        expectedPublicationRevision: null,
        submittedRevision: pending.latestSubmission.submittedRevision,
        reason: '',
      },
      { user: staff, status: 400 }
    );
    await publication(id, 'reject');
    assert.equal((await releaseState(id)).latestSubmission.status, 'rejected');
    await publication(id, 'submit');
    const frozen = (await releaseState(id)).latestSubmission;
    await updateRelease(id, { ...fields, title: 'Later unpublished edit' });
    await service('stop', 'editorial-materializer');
    const approved = await publication(id, 'approve');
    assert.equal(approved.result.publicationRevision, 1);
    await call(publicRelease(), { user: null, status: 503 });
    const canonical = await read(
      `${releases}/source/${applicationId}?releaseId=${releaseId}`
    );
    assert.equal(canonical.release.title, frozen.title);
    await service('start', 'editorial-materializer');
    const visible = await publicRevision(1);
    assert.equal(visible.title, frozen.title);
    assert.equal(visible.claimId, undefined);
    assert.equal(visible.latestSubmission, undefined);
    const independent = await command(
      '/auth/signin',
      { email: users[0].email, password: users[0].password },
      { user: null, status: 200 }
    );
    assert.deepEqual(
      await read(releasePath(id), independent),
      await read(releasePath(id))
    );
    pass(
      'future-date and stale-revision denials; rejection/resubmission and independent approval freeze submitted content while later draft edits remain private'
    );

    const listPath = `/api/catalog/releases/${applicationFields.slug}`;
    assert.equal(
      (await read(listPath + '?channel=stable&before=2026-01-02', null))
        .items[0].version,
      fields.version
    );
    assert.equal((await read(listPath + '?channel=prerelease', null)).total, 0);
    assert.equal((await read(listPath + '?before=2026-01-01', null)).total, 0);
    assert.deepEqual((await read(listPath + '?page=2', null)).items, []);
    await call(listPath + '?page=10001', { user: null, status: 400 });
    await updateRelease(id, { ...fields, version: '2.0.0' }, { status: 409 });
    const duplicate = await createRelease(input);
    await publication(duplicate.id, 'submit');
    await publication(duplicate.id, 'approve', { status: 409 });
    await publication(duplicate.id, 'reject');
    pass(
      'anonymous public list/version and channel/date/page filters; version punctuation survives encoding, published URLs are immutable and duplicate versions conflict'
    );

    await service('stop', 'catalog-bff');
    for (const path of [
      releases,
      releases.toUpperCase() + '/',
      releaseReviews,
      releaseReviews.toUpperCase() + '/unknown',
      listPath,
      publicRelease(),
      '/api/catalog/RELEASES/' + applicationFields.slug + '/unknown/suffix',
    ])
      await call(path, { status: [502, 503, 504] });
    await service('start', 'catalog-bff');
    await until(() => read(releases), 'BFF did not recover');
    assert.deepEqual(
      await command(approved.path, approved.body, {
        user: staff,
        key: approved.key,
      }),
      approved.result
    );
    await publicRevision(1);
    pass(
      'all release families, including case/slash variants and unknown suffixes, require BFF; restart preserves public content and historical approval receipts'
    );

    const imported = await openRelease(releaseId, claimId, 1);
    await updateRelease(imported.result.id, {
      ...fields,
      title: 'Old grant pending revision',
    });
    await publication(imported.result.id, 'submit');
    await service('stop', 'editorial-materializer');
    await service('stop', 'mongodb');
    await call(publicRelease(), { user: null, status: 503 });
    const claim = await read(`${claimsPath}/${claimId}`);
    await command(
      `${reviews}/${claimId}/decision`,
      {
        decision: 'revoke',
        expectedRevision: claim.revision,
        reason: 'Disposable grant revocation qualification.',
      },
      { user: staff }
    );
    await call(`${releases}/source/${applicationId}`, { status: 404 });
    await command(
      `${releasePath(id)}/rebase`,
      {
        expectedRevision: (await read(releasePath(id))).revision,
        expectedPublicationRevision: 1,
        fields,
      },
      { status: 403 }
    );
    await publication(id, 'submit', { status: 403 });
    await publication(imported.result.id, 'approve', { status: 403 });
    await updateRelease(id, {
      ...fields,
      title: 'Private edit after revocation',
    });
    await publication(imported.result.id, 'reject');
    assert.deepEqual(
      await command(approved.path, approved.body, {
        user: staff,
        key: approved.key,
      }),
      approved.result
    );
    await service('start', 'mongodb');
    assert.equal((await projection(releaseId)).revision, 1);
    await service('start', 'editorial-materializer');
    await publicRevision(1);
    pass(
      'Mongo outage stays explicit; canonical revocation blocks rebase/submission/approval during lag while private edits, staff rejection and historical replay remain valid'
    );

    const replacementClaim = await grant();
    await until(async () => {
      assert.equal((await read(publicPath, null)).revision, 4);
    }, 'Replacement ownership did not project');
    await publication(id, 'submit', { status: 403 });
    const replacement = await openRelease(releaseId, replacementClaim, 1),
      currentId = replacement.result.id;
    const stale = await openRelease(releaseId, replacementClaim, 1);
    await updateRelease(currentId, {
      ...fields,
      title: 'Approved replacement',
    });
    await publication(currentId, 'submit');
    await service('stop', 'editorial-materializer');
    const replacementApproval = await publication(currentId, 'approve');
    assert.equal(replacementApproval.result.publicationRevision, 2);
    await call(publicRelease(), { user: null, status: 503 });
    await command(
      `${releasePath(stale.result.id)}/rebase`,
      { expectedRevision: 1, expectedPublicationRevision: 1, fields },
      { status: 409 }
    );
    const rebased = await command(`${releasePath(stale.result.id)}/rebase`, {
      expectedRevision: 1,
      expectedPublicationRevision: 2,
      fields: { ...fields, title: 'Merged private notes' },
    });
    assert.equal(rebased.revision, 2);
    assert.equal(
      (await read(releasePath(stale.result.id))).target
        .sourcePublicationRevision,
      2
    );
    assert.equal((await projection(releaseId)).revision, 1);
    const withdrawal = await publication(currentId, 'withdraw');
    assert.equal(withdrawal.result.publicationRevision, 3);
    await call(publicRelease(), { user: null, status: 404 });
    assert.equal((await read(listPath, null)).total, 0);
    const withdrawnSource = await read(
      `${releases}/source/${applicationId}?releaseId=${releaseId}`
    );
    assert.equal(withdrawnSource.release.visible, false);
    assert.equal(withdrawnSource.release.revision, 3);
    assert.equal((await projection(releaseId)).revision, 1);
    pass(
      'new grant requires a newly bound draft; canonical open/rebase detects stale revisions, and withdrawal hides releases while revision-1 public projection remains stored'
    );

    await service('stop', 'editorial');
    await call(releasePath(currentId), { status: 503 });
    await call(publicRelease(), { user: null, status: 503 });
    await service('start', 'editorial');
    await until(() => read(releases), 'Editorial did not recover');
    assert.deepEqual(
      await command(replacementApproval.path, replacementApproval.body, {
        user: staff,
        key: replacementApproval.key,
      }),
      replacementApproval.result
    );
    assert.deepEqual(
      await command(withdrawal.path, withdrawal.body, { key: withdrawal.key }),
      withdrawal.result
    );
    await call(publicRelease(), { user: null, status: 404 });
    await service('start', 'editorial-materializer');
    await until(async () => {
      const value = await projection(releaseId);
      assert.equal(value.revision, 3);
      assert.notEqual(value.deletedAt, null);
    }, 'Release tombstone did not converge');
    await call(publicRelease(), { user: null, status: 404 });
    const withdrawnDuplicate = await createRelease({
      applicationId,
      claimId: replacementClaim,
      fields,
    });
    await publication(withdrawnDuplicate.id, 'submit');
    await publication(withdrawnDuplicate.id, 'approve', { status: 409 });
    await publication(withdrawnDuplicate.id, 'withdraw');
    pass(
      'Editorial outage/restart, queued replacement/withdrawal and historical approval replay converge to the revision-3 tombstone without resurrecting or reusing the version'
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
    if (applicationId)
      try {
        await until(
          () => read(releases),
          'Release API did not recover for cleanup'
        );
        await hideParent();
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const id of [...releaseDrafts].reverse())
      try {
        const result = await call(releasePath(id), { status: [200, 404] });
        if (result.response.status === 404) continue;
        const body = { expectedRevision: result.value.revision },
          key = randomUUID();
        const deleted = await command(releasePath(id), body, {
          method: 'DELETE',
          key,
        });
        assert.equal(deleted.deleted, true);
        assert.deepEqual(
          await command(releasePath(id), body, { method: 'DELETE', key }),
          deleted
        );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const claim of claims)
      try {
        const current = await read(`${claimsPath}/${claim}`);
        if (
          ['awaiting-proof', 'awaiting-review', 'approved'].includes(
            current.status
          )
        )
          await command(
            `${claimsPath}/${claim}/${
              current.status === 'approved' ? 'release' : 'cancel'
            }`,
            { expectedRevision: current.revision }
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const id of [...drafts].reverse())
      try {
        const result = await call(`${draftsPath}/${id}`, {
          status: [200, 404],
        });
        if (result.response.status === 200)
          await command(
            `${draftsPath}/${id}`,
            { expectedRevision: result.value.revision },
            { method: 'DELETE' }
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const name of [...dns.keys()])
      try {
        setDns(name, undefined);
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (applicationId)
      try {
        await call(publicPath, { user: null, status: 404 });
        await call(publicRelease(), { user: null, status: 404 });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const user of cleanupErrors.length ? [] : [...users].reverse())
      if (user.uid)
        try {
          await call('/api/me', { user, method: 'DELETE', status: 202 });
          erased.push(user.uid);
          persist();
          await call(releases, { user, status: [401, 403] });
        } catch (error) {
          cleanupErrors.push(error);
        }
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Release cleanup incomplete; use recovery records'
        : 'Release qualification failed'
    );
  pass(
    'disposable parent withdrawn, drafts deleted with stable replay, grants/DNS cleaned and two erasures accepted; background erasure completion is not claimed'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
