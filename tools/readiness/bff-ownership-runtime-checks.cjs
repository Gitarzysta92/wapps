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
    checks = [],
    erased = [],
    cleanupErrors = [];
  const stopped = new Set(),
    dns = new Map();
  let staff, applicationId, publicPath, failure;
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
          claims,
          drafts,
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
    if (action === 'start' && name === 'editorial')
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
  const userFor = (record) =>
    record.uid === staff?.uid ? staff : users.find((u) => u.uid === record.uid);
  const state = (record) => read(`${claimsPath}/${record.id}`, userFor(record));
  async function createClaim(user = users[1], fields = {}, key = randomUUID()) {
    const input = {
      applicationId,
      evidenceUrl: 'https://evidence.example.test/team',
      notes: 'Disposable ownership proof and independent review qualification.',
      ...fields,
    };
    const receipt = await command(claimsPath, input, { user, key });
    const record = { id: receipt.id, uid: user.uid };
    claims.push(record);
    persist();
    return { record, receipt, input, key };
  }
  const change = (record, action, body, options = {}) => {
    const review = ['approve', 'reject', 'revoke'].includes(action);
    return command(
      `${review ? reviews : claimsPath}/${record.id}/${
        review ? 'decision' : action
      }`,
      review ? { ...body, decision: action } : body,
      { user: review ? staff : userFor(record), ...options }
    );
  };
  async function prove(record) {
    const current = await state(record);
    setDns(current.challengeName, current.challengeValue);
    const receipt = await change(record, 'verify', {
      expectedRevision: current.revision,
    });
    assert.equal(receipt.proofMatched, true);
    return receipt;
  }
  async function approve(record) {
    return change(record, 'approve', {
      expectedRevision: (await state(record)).revision,
      reason: 'Independent disposable ownership review.',
    });
  }
  const sourcePath = () => `${draftsPath}/canonical/${applicationId}`;
  const editing = (source) => ({
    applicationId: source.applicationId,
    claimId: source.claimId,
    sourcePublicationRevision: source.sourcePublicationRevision,
  });
  async function openDraft(record, fields) {
    const source = await read(sourcePath(), userFor(record));
    const body = { editing: editing(source), fields: fields ?? source.fields },
      key = randomUUID();
    const receipt = await command(draftsPath + '/from-application', body, {
      user: userFor(record),
      key,
    });
    const draft = { id: receipt.id, uid: record.uid, claimId: record.id };
    drafts.push(draft);
    persist();
    return { source, body, key, receipt, draft };
  }
  async function deleteDraft(draft) {
    const user = userFor(draft),
      path = `${draftsPath}/${draft.id}`;
    const result = await call(path, { user, status: [200, 404] });
    if (result.response.status === 404) return;
    const body = { expectedRevision: result.value.revision },
      key = randomUUID();
    const receipt = await command(path, body, { user, key, method: 'DELETE' });
    assert.equal(receipt.deleted, true);
    assert.deepEqual(
      await command(path, body, { user, key, method: 'DELETE' }),
      receipt
    );
  }
  async function projection() {
    assert.ok(applicationId && drafts.some((d) => d.id === applicationId));
    // Read only the disposable projection; database credentials stay in the container.
    const script = `const {MongoClient}=require('mongodb');(async()=>{const e=process.env;const c=new MongoClient('mongodb://'+encodeURIComponent(e.MONGO_USERNAME)+':'+encodeURIComponent(e.MONGO_PASSWORD)+'@'+e.MONGO_HOST+':'+e.MONGO_PORT,{serverSelectionTimeoutMS:3000});try{await c.connect();const p=await c.db(e.MONGO_DATABASE).collection('editorial_projections_v1').findOne({kind:'app',resourceId:process.argv[1]},{projection:{_id:0,revision:1,deletedAt:1}});console.log(JSON.stringify(p));}finally{await c.close();}})().catch(()=>{console.error('Projection observation failed');process.exitCode=1;});`;
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
        applicationId,
      ],
      { timeout: 10000, maxBuffer: 4096 }
    );
    return JSON.parse(result.stdout);
  }
  async function publicRevision(revision) {
    return until(async () => {
      const value = await read(publicPath, null);
      assert.equal(value.revision, revision);
      return value;
    }, 'Public application revision did not converge');
  }
  async function withdrawDisposable() {
    if (!applicationId) return;
    const visible = await call(publicPath, {
      user: null,
      status: [200, 404, 503],
    });
    if (visible.response.status === 404) return;
    let active;
    for (const record of claims)
      if ((await state(record)).status === 'approved') active = record;
    if (!active) {
      for (const record of claims) {
        const current = await state(record);
        if (
          record.uid === users[1].uid &&
          ['awaiting-proof', 'awaiting-review'].includes(current.status)
        )
          await change(record, 'cancel', {
            expectedRevision: current.revision,
          });
      }
      active = (await createClaim()).record;
      await prove(active);
      await approve(active);
    }
    // Old claim-bound editing drafts remain private, but cannot authorize this new grant.
    for (const draft of drafts.filter(
      (d) => d.claimId && d.uid === active.uid && d.claimId !== active.id
    ))
      await deleteDraft(draft);
    let draft;
    for (const candidate of drafts.filter((d) => d.claimId === active.id)) {
      if (
        (
          await call(`${draftsPath}/${candidate.id}`, {
            user: userFor(candidate),
            status: [200, 404],
          })
        ).response.status === 200
      )
        draft = candidate;
    }
    if (!draft) draft = (await openDraft(active)).draft;
    const path = `${draftsPath}/${draft.id}`,
      user = userFor(draft);
    const source = await read(sourcePath(), user),
      current = await read(path, user);
    if (
      current.editing.sourcePublicationRevision !==
      source.sourcePublicationRevision
    )
      await command(
        path + '/rebase',
        {
          editing: editing(source),
          fields: source.fields,
          expectedRevision: current.revision,
        },
        { user }
      );
    await command(
      path + '/withdraw',
      { expectedRevision: (await read(path, user)).revision },
      { user }
    );
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
    for (const nickname of ['BFF Ownership Author', 'BFF Ownership Claimant']) {
      const user = {
        email: 'bff-ownership-' + randomUUID() + '@wapps-review.test',
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
    const [author, claimant] = users;
    const fields = {
      name: 'BFF Ownership ' + randomUUID().slice(0, 8),
      slug: 'bff-ownership-' + randomUUID(),
      website: 'https://bff-ownership-' + randomUUID() + '.example.test',
      description:
        'Original public application content must remain intact during ownership changes.',
      classification: 'general',
    };
    const created = await command(draftsPath, fields);
    applicationId = created.id;
    publicPath = '/api/catalog/apps/' + fields.slug;
    drafts.push({ id: applicationId, uid: author.uid });
    persist();
    await command(`${draftsPath}/${applicationId}/submit`, {
      expectedRevision: 1,
    });
    await command(
      `${publicationReviews}/${applicationId}/decision`,
      { decision: 'approve', expectedRevision: 2, submittedRevision: 1 },
      { user: staff }
    );
    await publicRevision(1);
    await service('restart', 'ownership-dns');

    const first = await createClaim(),
      firstState = await state(first.record);
    assert.equal(firstState.hostname, new URL(fields.website).hostname);
    assert.notEqual(
      firstState.hostname,
      new URL(first.input.evidenceUrl).hostname
    );
    assert.deepEqual(
      await command(claimsPath, first.input, {
        user: claimant,
        key: first.key,
      }),
      first.receipt
    );
    await command(
      claimsPath,
      { ...first.input, notes: first.input.notes + ' changed' },
      { user: claimant, key: first.key, status: 409 }
    );
    await command(claimsPath, first.input, { user: claimant, status: 409 });
    for (const user of [null, { token: 'invalid' }])
      await call(claimsPath, { user, status: 401 });
    await call(`${claimsPath}/${first.record.id}`, {
      user: author,
      status: 404,
    });
    await call(reviews, { user: claimant, status: 403 });
    await call(`${reviews}/${first.record.id}`, {
      user: claimant,
      status: 403,
    });
    await command(
      `${reviews}/${first.record.id}/decision`,
      { decision: 'approve', expectedRevision: 1 },
      {
        user: claimant,
        headers: {
          'x-user-id': staff.uid,
          'x-user-claims': '{"roles":["staff"]}',
        },
        status: 403,
      }
    );
    await call(claimsPath + '?owner=' + claimant.uid, {
      user: claimant,
      status: 400,
    });
    await call(claimsPath + '?view=grants', { user: claimant, status: 400 });
    await command(
      claimsPath,
      { ...first.input, website: 'https://attacker.test' },
      { user: claimant, status: 400 }
    );
    assert.ok(
      (await read(claimsPath, claimant)).items.some(
        (c) => c.id === first.record.id
      )
    );
    assert.ok(
      !(await read(claimsPath, author)).items.some(
        (c) => c.id === first.record.id
      )
    );
    await change(
      first.record,
      'approve',
      { expectedRevision: 1 },
      { status: 409 }
    );
    await call(sourcePath(), { user: claimant, status: 404 });
    pass(
      'claims bind the canonical website, enforce private/staff access, reject spoofed authority and preserve creation replay/conflicts; proof and approval are required'
    );

    setDns(
      '_wapps-ownership.evidence-' + randomUUID() + '.example.test',
      firstState.challengeValue
    );
    const falseKey = randomUUID(),
      falseBody = { expectedRevision: 1 };
    const unmatched = await change(first.record, 'verify', falseBody, {
      key: falseKey,
    });
    assert.equal(unmatched.proofMatched, false);
    assert.equal((await state(first.record)).status, 'awaiting-proof');
    assert.deepEqual(
      await change(first.record, 'verify', falseBody, { key: falseKey }),
      unmatched
    );
    await change(
      first.record,
      'verify',
      { expectedRevision: 2 },
      { status: 429 }
    );
    await change(first.record, 'cancel', { expectedRevision: 2 });
    assert.deepEqual(
      await command(claimsPath, first.input, {
        user: claimant,
        key: first.key,
      }),
      first.receipt
    );
    assert.equal((await state(first.record)).status, 'cancelled');
    pass(
      'proof at another hostname cannot verify the canonical domain; failed-proof receipts replay, fresh checks are throttled and cancellation stays current'
    );

    const self = (await createClaim(staff)).record;
    await prove(self);
    await call(`${reviews}/${self.id}`, { user: staff, status: 403 });
    await change(self, 'approve', { expectedRevision: 2 }, { status: 403 });
    assert.ok(
      !(await read(reviews, staff)).items.some((c) => c.id === self.id)
    );
    await change(self, 'cancel', { expectedRevision: 2 });
    const rejected = (await createClaim(author)).record;
    await prove(rejected);
    await change(
      rejected,
      'reject',
      { expectedRevision: 2, reason: '' },
      { status: 400 }
    );
    await change(rejected, 'reject', {
      expectedRevision: 2,
      reason: 'Evidence is insufficient for this disposable claim.',
    });
    assert.equal(
      (await state(rejected)).reason,
      'Evidence is insufficient for this disposable claim.'
    );
    pass(
      'staff cannot read or approve their own claim for review; rejection requires and preserves an independent reason'
    );

    const competing = (await createClaim(author)).record;
    await prove(competing);
    const mainClaim = (await createClaim()).record,
      mainState = await state(mainClaim);
    setDns(mainState.challengeName, mainState.challengeValue);
    const verifyKey = randomUUID(),
      verifyBody = { expectedRevision: 1 };
    await service('stop', 'ownership-dns');
    await change(mainClaim, 'verify', verifyBody, {
      key: verifyKey,
      status: 503,
    });
    assert.equal((await state(mainClaim)).revision, 1);
    await service('start', 'ownership-dns');
    const verified = await until(async () => {
      const result = await call(`${claimsPath}/${mainClaim.id}/verify`, {
        user: claimant,
        method: 'POST',
        body: verifyBody,
        key: verifyKey,
        status: [201, 503],
      });
      assert.equal(result.response.status, 201);
      return result.value;
    }, 'Original-key DNS recovery did not finish');
    assert.equal(verified.proofMatched, true);
    assert.deepEqual(
      await change(mainClaim, 'verify', verifyBody, { key: verifyKey }),
      verified
    );
    await call(sourcePath(), { user: claimant, status: 404 });
    assert.ok(
      (await read(reviews + '?view=pending', staff)).items.some(
        (c) => c.id === mainClaim.id
      )
    );
    const independent = await command(
      '/auth/signin',
      { email: claimant.email, password: claimant.password },
      { user: null, status: 200 }
    );
    assert.deepEqual(
      await read(`${claimsPath}/${mainClaim.id}`, independent),
      await state(mainClaim)
    );
    pass(
      'DNS outage preserves the claim and returns an uncertain failure; same-key recovery verifies once, and proof alone grants no editing access'
    );

    await service('stop', 'editorial-materializer');
    const priorProjection = await projection();
    assert.equal(priorProjection.revision, 1);
    const approvalBody = {
        expectedRevision: 2,
        reason: 'Independent staff approval after canonical DNS proof.',
      },
      approvalKey = randomUUID();
    const approved = await change(mainClaim, 'approve', approvalBody, {
      key: approvalKey,
    });
    assert.equal(approved.applicationRevision, 2);
    assert.equal((await projection()).revision, 1);
    await call(publicPath, { user: null, status: 503 });
    const opened = await openDraft(mainClaim, {
      ...fields,
      description:
        'Private owner changes awaiting another independent content review.',
    });
    assert.equal(opened.source.claimId, mainClaim.id);
    assert.equal(opened.source.sourcePublicationRevision, 2);
    await call(sourcePath(), { user: author, status: 404 });
    await change(
      competing,
      'approve',
      { expectedRevision: 2 },
      { status: 409 }
    );
    assert.equal((await state(competing)).status, 'awaiting-review');
    await change(competing, 'cancel', { expectedRevision: 2 });
    await command(claimsPath, first.input, { user: author, status: 409 });
    assert.ok(
      (await read(reviews + '?view=grants', staff)).items.some(
        (c) => c.id === mainClaim.id
      )
    );
    await service('start', 'editorial-materializer');
    assert.equal((await publicRevision(2)).description, fields.description);
    const draftPath = `${draftsPath}/${opened.draft.id}`;
    await command(
      draftPath + '/submit',
      { expectedRevision: 1 },
      { user: claimant }
    );
    assert.equal(
      (await read(draftPath + '/publication', claimant)).latestSubmission
        .status,
      'submitted'
    );
    assert.equal(
      (await read(publicPath, null)).description,
      fields.description
    );
    pass(
      'approval grants canonical editing during projection lag, prevents competing grants and preserves independent review for future content changes'
    );

    const routes = [
      [claimsPath, claimant, undefined],
      [claimsPath, claimant, first.input],
      [`${claimsPath}/${mainClaim.id}`, claimant, undefined],
      ...['verify', 'cancel', 'release'].map((action) => [
        `${claimsPath}/${mainClaim.id}/${action}`,
        claimant,
        { expectedRevision: 3 },
      ]),
      [reviews, staff, undefined],
      [reviews + '?view=grants', staff, undefined],
      [`${reviews}/${mainClaim.id}`, staff, undefined],
      [
        `${reviews}/${mainClaim.id}/decision`,
        staff,
        { ...approvalBody, decision: 'approve' },
      ],
      [claimsPath.toUpperCase() + '/', claimant, undefined],
      [reviews.toUpperCase() + '/', staff, undefined],
      [`${claimsPath}/${mainClaim.id}/unknown`, claimant, {}],
      [`${reviews}/${mainClaim.id}/decision/unknown`, staff, {}],
    ];
    await service('stop', 'catalog-bff');
    for (const [path, user, body] of routes)
      await call(path, {
        user,
        body,
        method: body === undefined ? 'GET' : 'POST',
        key: randomUUID(),
        status: [502, 503, 504],
      });
    await service('start', 'catalog-bff');
    await until(() => read(claimsPath, claimant), 'BFF did not recover');
    assert.equal((await state(mainClaim)).status, 'approved');
    assert.deepEqual(
      await change(mainClaim, 'approve', approvalBody, { key: approvalKey }),
      approved
    );
    await call(claimsPath.toUpperCase() + '/', { user: claimant });
    await call(reviews.toUpperCase() + '/', { user: staff });
    await command(
      `${claimsPath}/${mainClaim.id}/unknown`,
      {},
      { user: claimant, status: 404 }
    );
    pass(
      'all ownership route families require BFF, including case/slash variants and unknown suffixes; restart preserves grant state and original receipts'
    );

    await service('stop', 'editorial-materializer');
    assert.equal((await projection()).revision, 2);
    await service('stop', 'mongodb');
    assert.equal((await state(mainClaim)).status, 'approved');
    await read(reviews + '?view=grants', staff);
    await change(
      mainClaim,
      'revoke',
      { expectedRevision: 3, reason: '' },
      { status: 400 }
    );
    const revokeBody = {
        expectedRevision: 3,
        reason:
          'Ownership revoked by independent staff during projection outage.',
      },
      revokeKey = randomUUID();
    const revoked = await change(mainClaim, 'revoke', revokeBody, {
      key: revokeKey,
    });
    assert.equal(revoked.applicationRevision, 3);
    await call(sourcePath(), { user: claimant, status: 404 });
    await command(
      draftPath + '/rebase',
      { editing: editing(opened.source), fields: fields, expectedRevision: 2 },
      { user: claimant, status: 403 }
    );
    await command(
      `${publicationReviews}/${opened.draft.id}/decision`,
      { decision: 'approve', expectedRevision: 2, submittedRevision: 1 },
      { user: staff, status: 403 }
    );
    await command(
      `${publicationReviews}/${opened.draft.id}/decision`,
      {
        decision: 'reject',
        expectedRevision: 2,
        submittedRevision: 1,
        reason: 'Ownership revoked before content approval.',
      },
      { user: staff }
    );
    await command(
      draftPath + '/submit',
      { expectedRevision: 3 },
      { user: claimant, status: 403 }
    );
    assert.deepEqual(
      await command(draftsPath + '/from-application', opened.body, {
        user: claimant,
        key: opened.key,
      }),
      opened.receipt
    );
    assert.deepEqual(
      await change(mainClaim, 'approve', approvalBody, { key: approvalKey }),
      approved
    );
    assert.equal((await state(mainClaim)).status, 'revoked');
    await call(sourcePath(), { user: claimant, status: 404 });
    await service('start', 'mongodb');
    await until(
      async () => assert.equal((await projection()).revision, 2),
      'Mongo did not recover the old projection'
    );
    await call(sourcePath(), { user: claimant, status: 404 });
    await service('start', 'editorial-materializer');
    assert.equal((await publicRevision(3)).description, fields.description);
    await deleteDraft(opened.draft);
    pass(
      'revocation works without Mongo and immediately removes canonical editing/publication authority despite the old projection; old approval/import receipts cannot restore access'
    );

    await service('stop', 'editorial');
    await call(`${claimsPath}/${mainClaim.id}`, {
      user: claimant,
      status: 503,
    });
    await call(reviews, { user: staff, status: 503 });
    await change(mainClaim, 'revoke', revokeBody, {
      key: revokeKey,
      status: 503,
    });
    await read('/api/me/profile', claimant);
    await service('start', 'editorial');
    await until(() => state(mainClaim), 'Editorial did not recover');
    assert.deepEqual(
      await change(mainClaim, 'revoke', revokeBody, { key: revokeKey }),
      revoked
    );
    assert.deepEqual(
      await change(mainClaim, 'approve', approvalBody, { key: approvalKey }),
      approved
    );
    await call(sourcePath(), { user: claimant, status: 404 });
    pass(
      'Editorial outage fails explicitly while unrelated account reads remain available; restart and historical approval/revocation replay preserve revoked authority'
    );

    const replacement = (await createClaim()).record;
    await prove(replacement);
    const replacementApproval = await approve(replacement);
    await publicRevision(replacementApproval.applicationRevision);
    await service('stop', 'editorial-materializer');
    const releaseBody = {
        expectedRevision: 3,
        reason: 'Claimant voluntarily releases this disposable grant.',
      },
      releaseKey = randomUUID();
    const released = await change(replacement, 'release', releaseBody, {
      key: releaseKey,
    });
    assert.equal(
      released.applicationRevision,
      replacementApproval.applicationRevision + 1
    );
    assert.equal(
      (await projection()).revision,
      replacementApproval.applicationRevision
    );
    await call(sourcePath(), { user: claimant, status: 404 });
    assert.equal((await state(replacement)).reason, releaseBody.reason);
    assert.deepEqual(
      await change(replacement, 'release', releaseBody, { key: releaseKey }),
      released
    );
    assert.ok(
      !(await read(reviews + '?view=grants', staff)).items.some(
        (c) => c.id === replacement.id || c.id === mainClaim.id
      )
    );
    await service('start', 'editorial-materializer');
    await publicRevision(released.applicationRevision);
    pass(
      'a new independently approved grant can be voluntarily released; canonical access ends before projection catch-up and release replay stays historical'
    );
    await withdrawDisposable();
  } catch (error) {
    failure = error;
  } finally {
    for (const name of [...stopped])
      try {
        await service('start', name);
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (applicationId) {
      try {
        await until(
          () => read(claimsPath, users[1]),
          'Ownership API did not recover for cleanup'
        );
        await withdrawDisposable();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const record of claims)
      try {
        const current = await state(record);
        if (
          ['awaiting-proof', 'awaiting-review', 'approved'].includes(
            current.status
          )
        )
          await change(
            record,
            current.status === 'approved' ? 'release' : 'cancel',
            { expectedRevision: current.revision }
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const draft of [...drafts].reverse())
      try {
        await deleteDraft(draft);
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const name of [...dns.keys()])
      try {
        setDns(name, undefined);
      } catch (error) {
        cleanupErrors.push(error);
      }
    if (publicPath)
      try {
        await call(publicPath, { user: null, status: 404 });
      } catch (error) {
        cleanupErrors.push(error);
      }
    for (const user of [...users].reverse()) {
      if (!user.uid) continue;
      try {
        await call('/api/me', { user, method: 'DELETE', status: 202 });
        erased.push(user.uid);
        persist();
        await call(claimsPath, { user, status: [401, 403] });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  if (failure || cleanupErrors.length)
    throw new AggregateError(
      [...(failure ? [failure] : []), ...cleanupErrors],
      cleanupErrors.length
        ? 'Ownership cleanup incomplete; use recovery records'
        : 'Ownership qualification failed'
    );
  pass(
    'disposable publication is withdrawn, drafts/grants/DNS fixtures are cleaned and two account erasures are accepted; existing staff and content remain intact'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
