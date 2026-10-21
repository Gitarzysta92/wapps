const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = '../../apps/services/editorial/src/app/';
const { ApplicationDrafts } = require(base +
  'application-drafts/application-drafts');
const { MysqlApplicationDrafts } = require(base +
  'application-drafts/mysql-application-drafts');
const { ApplicationPublication } = require(base +
  'application-publication/application-publication');
const { MysqlApplicationPublication } = require(base +
  'application-publication/mysql-application-publication');
const { ApplicationPublication1791676811000 } = require(base +
  'application-publication/application-publication.migration');
const { ApplicationEditing1791676813000 } = require(base +
  'application-drafts/application-editing.migration');
const { EditorialCommands } = require(base + 'application/editorial-commands');
const { MysqlEditorialWrites } = require(base +
  'infrastructure/mysql-editorial-writes');

async function applicationOwnershipAuthoringChecks({
  source,
  policy,
  ownership,
  records,
  now,
  pass,
}) {
  const drafts = new ApplicationDrafts(
    new MysqlApplicationDrafts(source),
    policy,
    { generate: randomUUID },
    now
  );
  const publication = new ApplicationPublication(
    new MysqlApplicationPublication(source),
    policy,
    now
  );
  const author = {
    identityId: 'OriginalApplicationAuthor',
    tenantId: 'default',
    roles: [],
  };
  const owner = {
    identityId: 'NewApplicationOwner',
    tenantId: 'default',
    roles: [],
  };
  const reviewer = {
    identityId: 'IndependentApplicationReviewer',
    tenantId: 'default',
    roles: ['editorial:reviewer', 'editorial:ownership-reviewer'],
  };
  const fields = {
    name: 'Transferred Application',
    slug: 'transferred-application',
    website: 'https://transfer.example.test',
    description:
      'Original approved application description, preserved after transfer.',
  };
  const create = async (slug) => {
    const created = await drafts.change(
      author,
      'create',
      null,
      { ...fields, slug },
      randomUUID()
    );
    const submission = await publication.change(
      author,
      created.id,
      'submit',
      { expectedRevision: 1 },
      randomUUID()
    );
    const key = randomUUID();
    const input = { expectedRevision: 2, submittedRevision: 1 };
    const receipt = await publication.change(
      reviewer,
      created.id,
      'approve',
      input,
      key
    );
    return { id: created.id, submission, key, input, receipt };
  };
  const claim = async (actor, id) => {
    const created = await ownership.create(
      actor,
      {
        applicationId: id,
        evidenceUrl: fields.website + '/team',
        notes:
          'I control the official application website and maintain this application.',
      },
      randomUUID()
    );
    const pending = await ownership.read(actor, created.id);
    records.set(pending.challengeName, pending.challengeValue);
    await ownership.change(
      actor,
      created.id,
      'verify',
      { expectedRevision: 1 },
      randomUUID()
    );
    return created.id;
  };
  const migrate = async () => {
    const runner = source.createQueryRunner();
    try {
      await new ApplicationPublication1791676811000().up(runner);
      await new ApplicationEditing1791676813000().up(runner);
    } finally {
      await runner.release();
    }
  };
  const canonical = async (id) => {
    const [row] = await source.query(
      `SELECT a.*, s.ownerIdentityId, s.revision, s.deletedAt FROM app_records a
      JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id WHERE a.id = ?`,
      [id]
    );
    return row;
  };
  const outbox = async () =>
    Number(
      (await source.query('SELECT COUNT(*) AS total FROM editorial_outbox'))[0]
        .total
    );
  const app = await create(fields.slug);
  await drafts.change(
    author,
    'update',
    app.id,
    {
      ...fields,
      description: 'A former author private change that never becomes public.',
      expectedRevision: 3,
    },
    randomUUID()
  );
  await publication.change(
    author,
    app.id,
    'submit',
    { expectedRevision: 4 },
    randomUUID()
  );
  const claimId = await claim(owner, app.id);
  await ownership.change(
    reviewer,
    claimId,
    'approve',
    { expectedRevision: 2 },
    randomUUID()
  );
  const transferred = await canonical(app.id);
  const before = await outbox();
  assert.equal(transferred.ownerIdentityId, owner.identityId);
  assert.equal(transferred.description, fields.description);
  assert.equal(
    (await publication.read(author, app.id)).latestSubmission.status,
    'submitted'
  );
  assert.match(
    (await drafts.read(author, app.id)).description,
    /former author private/
  );
  await assert.rejects(drafts.read(owner, app.id), /not found/);
  await assert.rejects(publication.read(owner, app.id), /not found/);
  await assert.rejects(
    publication.read({ ...author, tenantId: 'other' }, app.id),
    /not found/
  );
  for (const action of ['submit', 'withdraw'])
    await assert.rejects(
      publication.change(
        author,
        app.id,
        action,
        { expectedRevision: 5 },
        randomUUID()
      ),
      /Forbidden/
    );
  await assert.rejects(
    publication.change(
      reviewer,
      app.id,
      'approve',
      { expectedRevision: 5, submittedRevision: 4 },
      randomUUID()
    ),
    /Forbidden/
  );
  assert.deepEqual(
    await publication.change(reviewer, app.id, 'approve', app.input, app.key),
    app.receipt
  );
  assert.deepEqual(await canonical(app.id), transferred);
  assert.equal(await outbox(), before);
  await migrate();
  await source.query(
    "UPDATE editorial_resource_states SET ownerIdentityId = 'UnrecordedOwner' WHERE resourceKind = 'app' AND resourceId = ?",
    [app.id]
  );
  try {
    await assert.rejects(migrate, /relationships/);
  } finally {
    await source.query(
      "UPDATE editorial_resource_states SET ownerIdentityId = ? WHERE resourceKind = 'app' AND resourceId = ?",
      [owner.identityId, app.id]
    );
  }
  await migrate();
  pass(
    'verified transfer preserves former-author private content and readable history, denies stale publication/withdrawal, and migration reentry requires recorded transfer authority'
  );

  await publication.change(
    reviewer,
    app.id,
    'reject',
    {
      expectedRevision: 5,
      submittedRevision: 4,
      reason:
        'Ownership changed before this review; existing public content is preserved.',
    },
    randomUUID()
  );
  const edited = await drafts.change(
    author,
    'update',
    app.id,
    {
      ...fields,
      description:
        'Former authors retain their own private edits after transfer.',
      expectedRevision: 6,
    },
    randomUUID()
  );
  await source.query(
    "CREATE TRIGGER fail_transferred_draft_delete BEFORE INSERT ON application_draft_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected private deletion failure'"
  );
  try {
    await assert.rejects(
      drafts.change(
        author,
        'delete',
        app.id,
        { expectedRevision: edited.revision },
        randomUUID()
      ),
      /Could not confirm/
    );
    assert.equal((await drafts.read(author, app.id)).revision, edited.revision);
    assert.equal(
      (await publication.read(author, app.id)).latestSubmission.status,
      'rejected'
    );
  } finally {
    await source.query('DROP TRIGGER fail_transferred_draft_delete');
  }
  const deleteKey = randomUUID();
  const removed = await drafts.change(
    author,
    'delete',
    app.id,
    { expectedRevision: edited.revision },
    deleteKey
  );
  assert.deepEqual(
    await drafts.change(
      author,
      'delete',
      app.id,
      { expectedRevision: edited.revision },
      deleteKey
    ),
    removed
  );
  await assert.rejects(drafts.read(author, app.id), /not found/);
  const [tombstone] = await source.query(
    'SELECT * FROM application_drafts WHERE id = ?',
    [app.id]
  );
  assert.equal(tombstone.name, '');
  assert.equal(tombstone.description, '');
  assert.equal(
    (
      await source.query(
        'SELECT * FROM application_submissions WHERE applicationId = ?',
        [app.id]
      )
    ).length,
    0
  );
  assert.deepEqual(await canonical(app.id), transferred);
  assert.equal(await outbox(), before);
  assert.deepEqual(
    await publication.change(reviewer, app.id, 'approve', app.input, app.key),
    app.receipt
  );
  await migrate();
  pass(
    'former-author private deletion is atomic, retryable and scrubbed without withdrawing or rewriting the transferred public application'
  );

  const self = await create('self-claimed-application');
  const selfClaim = await claim(author, self.id);
  await ownership.change(
    reviewer,
    selfClaim,
    'approve',
    { expectedRevision: 2 },
    randomUUID()
  );
  await assert.rejects(
    publication.change(
      author,
      self.id,
      'submit',
      { expectedRevision: 3 },
      randomUUID()
    ),
    /Forbidden/
  );
  await ownership.change(
    author,
    selfClaim,
    'release',
    { expectedRevision: 3 },
    randomUUID()
  );
  const released = await canonical(self.id);
  assert.equal(released.ownerIdentityId, author.identityId);
  await assert.rejects(
    publication.change(
      author,
      self.id,
      'submit',
      { expectedRevision: 3 },
      randomUUID()
    ),
    /Forbidden/
  );
  await assert.rejects(
    publication.change(
      author,
      self.id,
      'withdraw',
      { expectedRevision: 3 },
      randomUUID()
    ),
    /Forbidden/
  );
  await drafts.change(
    author,
    'delete',
    self.id,
    { expectedRevision: 3 },
    randomUUID()
  );
  assert.deepEqual(await canonical(self.id), released);
  await migrate();
  pass(
    'same-identity claims retire unbound drafts and release never restores old authoring rights or permits private deletion to erase the public application'
  );

  const imported = await drafts.source(owner, app.id);
  assert.equal(imported.claimId, claimId);
  assert.equal(
    imported.sourcePublicationRevision,
    Number(transferred.revision)
  );
  assert.equal(imported.fields.description, fields.description);
  await assert.rejects(drafts.source(author, app.id), /No active ownership/);
  await assert.rejects(
    drafts.source({ ...owner, tenantId: 'other' }, app.id),
    /No active ownership/
  );
  const currentFields = imported.fields;
  const editing = {
    applicationId: imported.applicationId,
    claimId: imported.claimId,
    sourcePublicationRevision: imported.sourcePublicationRevision,
  };
  const openInput = {
    editing,
    fields: {
      ...currentFields,
      description:
        'Verified owner changes submitted for independent publication review.',
    },
  };
  const openKey = randomUUID();
  const opened = await drafts.editExisting(
    owner,
    'open',
    null,
    openInput,
    openKey
  );
  assert.notEqual(opened.id, app.id);
  assert.deepEqual(
    await drafts.editExisting(owner, 'open', null, openInput, openKey),
    opened
  );
  await assert.rejects(
    drafts.editExisting(
      owner,
      'open',
      null,
      { ...openInput, editing: { ...editing, claimId: selfClaim } },
      randomUUID()
    ),
    /Forbidden/
  );
  await assert.rejects(
    drafts.editExisting(author, 'open', null, openInput, randomUUID()),
    /Forbidden/
  );
  assert.deepEqual((await drafts.read(owner, opened.id)).editing, editing);
  assert.deepEqual(
    (await drafts.list(owner)).find((item) => item.id === opened.id).editing,
    editing
  );
  await assert.rejects(drafts.read(author, opened.id), /not found/);
  await publication.change(
    owner,
    opened.id,
    'submit',
    { expectedRevision: 1 },
    randomUUID()
  );
  const laterFields = {
    ...openInput.fields,
    description:
      'Additional private work stays private when the previous version is approved.',
  };
  await drafts.change(
    owner,
    'update',
    opened.id,
    { ...laterFields, expectedRevision: 2 },
    randomUUID()
  );
  const reviewInput = { expectedRevision: 3, submittedRevision: 1 };
  const approveKey = randomUUID();
  await source.query(
    "CREATE TRIGGER fail_verified_publication BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected verified publication failure'"
  );
  try {
    await assert.rejects(
      publication.change(
        reviewer,
        opened.id,
        'approve',
        reviewInput,
        approveKey
      ),
      /Could not confirm/
    );
    assert.equal(
      (await publication.read(owner, opened.id)).latestSubmission.status,
      'submitted'
    );
    assert.equal((await drafts.read(owner, opened.id)).revision, 3);
    assert.equal(
      (await drafts.read(owner, opened.id)).editing.sourcePublicationRevision,
      editing.sourcePublicationRevision
    );
    assert.deepEqual(await canonical(app.id), transferred);
  } finally {
    await source.query('DROP TRIGGER fail_verified_publication');
  }
  const approved = await publication.change(
    reviewer,
    opened.id,
    'approve',
    reviewInput,
    approveKey
  );
  assert.equal(
    (await canonical(app.id)).description,
    openInput.fields.description
  );
  assert.equal(
    (await source.query('SELECT id FROM app_records WHERE id = ?', [opened.id]))
      .length,
    0
  );
  assert.equal(
    (await drafts.read(owner, opened.id)).description,
    laterFields.description
  );
  assert.equal(
    (await drafts.read(owner, opened.id)).editing.sourcePublicationRevision,
    approved.publicationRevision
  );
  assert.equal(
    (await publication.read(owner, opened.id)).publishedSubmissionRevision,
    1
  );
  await migrate();
  pass(
    'verified owners edit separate grant-bound private drafts; review publishes the frozen submission to the existing canonical application while preserving later private edits'
  );

  const editorial = new EditorialCommands(
    new MysqlEditorialWrites(source, 'default'),
    policy,
    { generate: randomUUID }
  );
  await publication.change(
    owner,
    opened.id,
    'submit',
    { expectedRevision: 4 },
    randomUUID()
  );
  await editorial.update(
    'app',
    app.id,
    {
      name: 'Canonical staff correction',
      expectedRevision: approved.publicationRevision,
    },
    { ...reviewer, roles: ['editorial:moderator'] },
    randomUUID()
  );
  const correction = await canonical(app.id);
  await assert.rejects(
    publication.change(
      reviewer,
      opened.id,
      'approve',
      { expectedRevision: 5, submittedRevision: 4 },
      randomUUID()
    ),
    /public application changed/
  );
  await assert.rejects(
    publication.change(
      owner,
      opened.id,
      'withdraw',
      { expectedRevision: 5 },
      randomUUID()
    ),
    /canonical application changed/
  );
  await assert.rejects(
    drafts.editExisting(
      owner,
      'rebase',
      opened.id,
      { ...openInput, expectedRevision: 5 },
      randomUUID()
    ),
    /canonical application changed/
  );
  assert.equal(
    (await drafts.read(owner, opened.id)).description,
    laterFields.description
  );
  const refreshed = await drafts.source(owner, app.id);
  const refreshedFields = refreshed.fields;
  const refreshedTarget = {
    applicationId: refreshed.applicationId,
    claimId: refreshed.claimId,
    sourcePublicationRevision: refreshed.sourcePublicationRevision,
  };
  const mergeInput = {
    editing: refreshedTarget,
    fields: { ...laterFields, name: refreshedFields.name },
    expectedRevision: 5,
  };
  const mergeKey = randomUUID();
  const intents = await outbox();
  await source.query(
    "CREATE TRIGGER fail_application_merge BEFORE INSERT ON application_draft_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected merge failure'"
  );
  try {
    await assert.rejects(
      drafts.editExisting(owner, 'rebase', opened.id, mergeInput, mergeKey),
      /Could not confirm/
    );
    assert.equal(
      (await publication.read(owner, opened.id)).latestSubmission.status,
      'submitted'
    );
    assert.equal(
      (await drafts.read(owner, opened.id)).editing.sourcePublicationRevision,
      approved.publicationRevision
    );
  } finally {
    await source.query('DROP TRIGGER fail_application_merge');
  }
  const merged = await drafts.editExisting(
    owner,
    'rebase',
    opened.id,
    mergeInput,
    mergeKey
  );
  assert.deepEqual(
    await drafts.editExisting(owner, 'rebase', opened.id, mergeInput, mergeKey),
    merged
  );
  assert.equal(
    (await publication.read(owner, opened.id)).latestSubmission.status,
    'cancelled'
  );
  assert.equal(
    (await drafts.read(owner, opened.id)).name,
    refreshedFields.name
  );
  assert.equal(
    (await drafts.read(owner, opened.id)).description,
    laterFields.description
  );
  assert.equal(await outbox(), intents);
  assert.deepEqual(await canonical(app.id), correction);
  await publication.change(
    owner,
    opened.id,
    'submit',
    { expectedRevision: 6 },
    randomUUID()
  );
  await publication.change(
    reviewer,
    opened.id,
    'approve',
    { expectedRevision: 7, submittedRevision: 6 },
    randomUUID()
  );
  assert.equal((await canonical(app.id)).description, laterFields.description);
  assert.equal((await canonical(app.id)).name, refreshedFields.name);
  await migrate();
  pass(
    'canonical edits fence stale submission approval and withdrawal; explicit revision-bound merging preserves private edits, atomically cancels pending review and leaves current publication untouched'
  );

  await publication.change(
    owner,
    opened.id,
    'submit',
    { expectedRevision: 8 },
    randomUUID()
  );
  await ownership.change(
    reviewer,
    claimId,
    'revoke',
    {
      expectedRevision: 3,
      reason: 'Grant revoked during pending content review.',
    },
    randomUUID()
  );
  const revoked = await canonical(app.id);
  await assert.rejects(
    publication.change(
      reviewer,
      opened.id,
      'approve',
      { expectedRevision: 9, submittedRevision: 8 },
      randomUUID()
    ),
    /Forbidden/
  );
  await assert.rejects(
    publication.change(
      owner,
      opened.id,
      'withdraw',
      { expectedRevision: 9 },
      randomUUID()
    ),
    /Forbidden/
  );
  await assert.rejects(drafts.source(owner, app.id), /No active ownership/);
  assert.deepEqual(
    await publication.change(
      reviewer,
      opened.id,
      'approve',
      reviewInput,
      approveKey
    ),
    approved
  );
  assert.deepEqual(await canonical(app.id), revoked);
  const reclaim = await claim(owner, app.id);
  await ownership.change(
    reviewer,
    reclaim,
    'approve',
    { expectedRevision: 2 },
    randomUUID()
  );
  const newSource = await drafts.source(owner, app.id);
  assert.notEqual(newSource.claimId, claimId);
  await assert.rejects(
    publication.change(
      reviewer,
      opened.id,
      'approve',
      { expectedRevision: 9, submittedRevision: 8 },
      randomUUID()
    ),
    /Forbidden/
  );
  const newFields = newSource.fields;
  const newTarget = {
    applicationId: newSource.applicationId,
    claimId: newSource.claimId,
    sourcePublicationRevision: newSource.sourcePublicationRevision,
  };
  await assert.rejects(
    drafts.editExisting(
      owner,
      'rebase',
      opened.id,
      { fields: newFields, editing: newTarget, expectedRevision: 9 },
      randomUUID()
    ),
    /permanently bound/
  );
  const currentPublic = await canonical(app.id);
  const beforeRemoval = await outbox();
  await drafts.change(
    owner,
    'delete',
    opened.id,
    { expectedRevision: 9 },
    randomUUID()
  );
  assert.deepEqual(await canonical(app.id), currentPublic);
  assert.equal(await outbox(), beforeRemoval);
  const fresh = await drafts.editExisting(
    owner,
    'open',
    null,
    { fields: newFields, editing: newTarget },
    randomUUID()
  );
  assert.notEqual(fresh.id, opened.id);
  await publication.change(
    owner,
    fresh.id,
    'submit',
    { expectedRevision: 1 },
    randomUUID()
  );
  await publication.change(
    reviewer,
    fresh.id,
    'approve',
    { expectedRevision: 2, submittedRevision: 1 },
    randomUUID()
  );
  await migrate();
  pass(
    'revocation blocks pending verified-owner publication and withdrawal; reapproval cannot revive old claim-bound drafts, and cleanup never erases public content'
  );
  const concurrentSource = await drafts.source(owner, app.id);
  const concurrentFields = concurrentSource.fields;
  const concurrentTarget = {
    applicationId: concurrentSource.applicationId,
    claimId: concurrentSource.claimId,
    sourcePublicationRevision: concurrentSource.sourcePublicationRevision,
  };
  const competing = await drafts.editExisting(
    owner,
    'open',
    null,
    {
      fields: { ...concurrentFields, slug: 'competing-verified-edit' },
      editing: concurrentTarget,
    },
    randomUUID()
  );
  await publication.change(
    owner,
    fresh.id,
    'submit',
    { expectedRevision: 3 },
    randomUUID()
  );
  await publication.change(
    owner,
    competing.id,
    'submit',
    { expectedRevision: 1 },
    randomUUID()
  );
  const intentCount = await outbox();
  const concurrentDecisions = await Promise.allSettled([
    publication.change(
      reviewer,
      fresh.id,
      'approve',
      { expectedRevision: 4, submittedRevision: 3 },
      randomUUID()
    ),
    publication.change(
      { ...reviewer, identityId: 'SecondIndependentReviewer' },
      competing.id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      randomUUID()
    ),
  ]);
  assert.equal(
    concurrentDecisions.filter((result) => result.status === 'fulfilled')
      .length,
    1
  );
  assert.equal(
    concurrentDecisions.filter((result) => result.status === 'rejected').length,
    1
  );
  assert.equal(await outbox(), intentCount + 1);
  assert.equal(
    Number((await canonical(app.id)).revision),
    concurrentSource.sourcePublicationRevision + 1
  );
  const [binding] = await source.query(
    'SELECT * FROM application_editing_targets WHERE draftId = ?',
    [fresh.id]
  );
  for (const malformed of [
    { ...binding, claimId: selfClaim },
    { ...binding, sourcePublicationRevision: 99999 },
    { ...binding, applicationId: fresh.id },
  ]) {
    await source.query(
      'UPDATE application_editing_targets SET applicationId = ?, claimId = ?, sourcePublicationRevision = ? WHERE draftId = ?',
      [
        malformed.applicationId,
        malformed.claimId,
        malformed.sourcePublicationRevision,
        fresh.id,
      ]
    );
    try {
      await assert.rejects(migrate);
    } finally {
      await source.query(
        'UPDATE application_editing_targets SET applicationId = ?, claimId = ?, sourcePublicationRevision = ? WHERE draftId = ?',
        [
          binding.applicationId,
          binding.claimId,
          binding.sourcePublicationRevision,
          fresh.id,
        ]
      );
    }
  }
  await migrate();
  pass(
    'competing grant-bound drafts publish exactly one canonical revision; migration reentry rejects corrupt target identities, grant bindings and impossible source revisions'
  );
}

module.exports = { applicationOwnershipAuthoringChecks };
