const assert = require('node:assert/strict');

module.exports = async function releaseParityNotifications({
  origins,
  source,
  services,
  owner,
  reviewer,
  watcher,
  disabled,
  second,
  applicationId,
  appFields,
  fields,
  request,
  change,
  create,
  edit,
  publication,
  replay,
  projection,
  until,
  restartAccount,
  restartBff,
}) {
  const inboxPath = '/api/me/notifications/favorites';
  const target = { kind: 'applications', id: applicationId };
  const recipients = [watcher, disabled];
  const inbox = (actor = watcher, options = {}) =>
    request(inboxPath, { actor, ...options });
  const cursor = async () =>
    Number(
      (
        await services.sql.query(
          'SELECT version FROM content_update_cursors WHERE targetKind=? AND targetId=?',
          ['applications', applicationId]
        )
      )[0].version
    );
  const rows = (actor) =>
    source.query(
      'SELECT version,delivered,readAt FROM identity_favorite_notifications WHERE identityId=? AND targetId=? ORDER BY version',
      [actor.uid, applicationId]
    );
  async function preferences(actor, modify) {
    const current = await request('/api/me/preferences', {
      actor,
      cache: 'no-store',
    });
    modify(current.preferences);
    return change(
      '/api/me/preferences',
      actor,
      {
        expectedRevision: current.revision,
        preferences: current.preferences,
      },
      { method: 'PUT', status: 200, cache: 'no-store' }
    );
  }
  async function save(actor, saved) {
    const current = await request('/api/me/favorites', { actor });
    return change(
      '/api/me/favorites',
      actor,
      {
        expectedRevision: current.revision,
        target,
        saved,
      },
      { method: 'PUT', status: 200 }
    );
  }
  async function due(actor) {
    // Only the disposable scheduler is accelerated; the compiled worker owns delivery.
    await source.query(
      'UPDATE identity_favorite_watches SET availableAt=0 WHERE identityId=? AND targetId=? AND leaseToken IS NULL',
      [actor.uid, applicationId]
    );
  }
  async function observe(actor, version) {
    await due(actor);
    await until(
      () =>
        source.query(
          'SELECT version,availableAt,leaseToken FROM identity_favorite_watches WHERE identityId=? AND targetId=?',
          [actor.uid, applicationId]
        ),
      (values) =>
        values.length === 1 &&
        Number(values[0].version) === version &&
        Number(values[0].availableAt) > 0 &&
        values[0].leaseToken === null,
      'Compiled favorite worker did not settle its observation'
    );
  }
  let versionNumber = 50;
  async function publish() {
    const content = {
      ...fields,
      version: `${versionNumber++}.0.0`,
      title: 'Watched release',
    };
    const draft = await create(content);
    await publication(draft.id, 'submit');
    const approved = await publication(draft.id, 'approve');
    await projection('release', approved.result.releaseId, 1);
    return { draft, content, approved };
  }

  await inbox(watcher, { status: 503 });
  await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'true' });
  await preferences(disabled, (value) => {
    value.notifications.inApp.favoriteUpdates = false;
  });
  for (const actor of recipients) {
    await save(actor, true);
    await observe(actor, await cursor());
    assert.equal((await rows(actor)).length, 0);
  }
  const baseline = await cursor();
  const privateFields = { ...fields, version: '49.0.0' };
  const privateDraft = await create(privateFields);
  await publication(privateDraft.id, 'submit');
  await edit(privateDraft.id, {
    ...privateFields,
    title: 'Private edit does not notify',
  });
  assert.equal(await cursor(), baseline);
  await observe(watcher, baseline);
  assert.equal((await rows(watcher)).length, 0);
  const approved = await publication(privateDraft.id, 'approve');
  for (const actor of recipients) await observe(actor, await cursor());
  assert.equal((await rows(watcher))[0].delivered, 1);
  assert.equal((await rows(disabled))[0].delivered, 0);
  const initial = (await inbox()).items;
  assert.equal(initial.length, 1);
  assert.deepEqual(initial[0].target, target);
  assert.equal(initial[0].title, appFields.name);
  assert.equal(initial[0].destination.slug, appFields.slug);
  assert.deepEqual((await inbox(second)).items, []);
  assert.deepEqual(await inbox(disabled), {
    enabled: false,
    items: [],
    next: null,
  });
  const readReceipt = await change(
    inboxPath + '/read',
    watcher,
    { id: initial[0].id },
    { method: 'PUT', status: 200 }
  );
  assert.deepEqual(
    await change(
      inboxPath + '/read',
      watcher,
      { id: initial[0].id },
      { method: 'PUT', status: 200 }
    ),
    readReceipt
  );
  await change(
    inboxPath + '/read',
    owner,
    { id: initial[0].id },
    { method: 'PUT', status: 400 }
  );
  assert.deepEqual(await replay(approved), approved.result);
  await edit(privateDraft.id, {
    ...privateFields,
    title: 'Another private edit',
  });
  await observe(watcher, await cursor());
  assert.equal((await rows(watcher)).length, 1);
  await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'true' });
  await restartBff();
  assert.equal(
    (await inbox(watcher, { at: origins[1] })).items[0].readAt,
    readReceipt.readAt
  );
  console.log(
    'PASS release notifications: explicit disabled-worker failure, actual compiled delivery, application-watch baseline, private-edit/replay silence, delivered/suppressed receipts and private read-state persistence'
  );

  await preferences(watcher, (value) => {
    value.notifications.inApp.enabled = false;
  });
  await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'false' });
  await publish();
  await publish();
  await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'true' });
  const coalescedVersion = await cursor();
  await observe(watcher, coalescedVersion);
  const coalesced = await rows(watcher);
  assert.equal(coalesced.length, 2);
  assert.equal(Number(coalesced[1].version), coalescedVersion);
  assert.equal(coalesced[1].delivered, 0);
  await preferences(watcher, (value) => {
    value.notifications.inApp.enabled = true;
  });
  assert.equal((await inbox()).items.length, 1);
  await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'false' });
  const recovered = await publish();
  await services.stopEditorial();
  try {
    await restartAccount({ FAVORITE_UPDATE_WORKER_ENABLED: 'true' });
    await due(watcher);
    await until(
      () =>
        source.query(
          'SELECT attempts,leaseToken FROM identity_favorite_watches WHERE identityId=? AND targetId=?',
          [watcher.uid, applicationId]
        ),
      (values) =>
        Number(values[0]?.attempts) > 0 && values[0].leaseToken === null,
      'Source outage did not retain retryable watch work'
    );
    await inbox(watcher, { status: 503 });
    assert.equal((await rows(watcher)).length, 2);
  } finally {
    await services.restartEditorial();
  }
  await observe(watcher, await cursor());
  assert.equal((await rows(watcher)).length, 3);
  assert.equal((await inbox()).items.length, 2);
  assert.deepEqual(await replay(recovered.approved), recovered.approved.result);
  await observe(watcher, await cursor());
  assert.equal((await rows(watcher)).length, 3);

  // Inbox rendering rechecks canonical parent visibility/classification, even with old projections.
  const appBase = '/api/me/application-drafts';
  const canonical = await request(`${appBase}/canonical/${applicationId}`, {
    actor: owner,
  });
  const opened = await change(appBase + '/from-application', owner, {
    editing: {
      applicationId,
      claimId: canonical.claimId,
      sourcePublicationRevision: canonical.sourcePublicationRevision,
    },
    fields: { ...canonical.fields, classification: 'mature' },
  });
  await services.stopWorker();
  await change(`${appBase}/${opened.id}/submit`, owner, {
    expectedRevision: 1,
  });
  await change(
    `/api/editorial/application-reviews/${opened.id}/decision`,
    reviewer,
    {
      decision: 'approve',
      expectedRevision: 2,
      submittedRevision: 1,
    }
  );
  assert.deepEqual((await inbox()).items, []);
  await preferences(watcher, (value) => {
    value.content.showMatureContent = true;
  });
  assert.equal((await inbox()).items.length, 2);
  await change(`${appBase}/${opened.id}/withdraw`, owner, {
    expectedRevision: 3,
  });
  assert.deepEqual((await inbox()).items, []);
  await request(`/api/catalog/releases/${appFields.slug}`, { status: 404 });
  const current = await request(`${appBase}/${opened.id}`, { actor: owner });
  await change(
    `${appBase}/${opened.id}`,
    owner,
    {
      ...canonical.fields,
      classification: 'general',
      expectedRevision: current.revision,
    },
    { method: 'PUT', status: 200 }
  );
  const resubmit = await request(`${appBase}/${opened.id}`, { actor: owner });
  await change(`${appBase}/${opened.id}/submit`, owner, {
    expectedRevision: resubmit.revision,
  });
  await change(
    `/api/editorial/application-reviews/${opened.id}/decision`,
    reviewer,
    {
      decision: 'approve',
      expectedRevision: resubmit.revision + 1,
      submittedRevision: resubmit.revision,
    }
  );
  await services.startWorker();
  const [appState] = await services.sql.query(
    "SELECT revision FROM editorial_resource_states WHERE resourceKind='app' AND resourceId=?",
    [applicationId]
  );
  await projection('app', applicationId, Number(appState.revision));
  await save(watcher, false);
  assert.deepEqual((await inbox()).items, []);
  await save(watcher, true);
  await observe(watcher, await cursor());
  assert.deepEqual((await inbox()).items, []);
  for (const actor of recipients) await save(actor, false);
  console.log(
    'PASS release notification delivery contract: coalesced application updates, recipient preferences, durable outage recovery, current parent access/classification during lag and removed/readded watch non-resurrection'
  );
};
