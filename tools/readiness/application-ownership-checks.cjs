const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { createSocket } = require('node:dgram');
const { Resolver } = require('node:dns/promises');
const { DataSource } = require('typeorm');
const base = '../../apps/services/editorial/src/app/';
const { ApplicationOwnership } = require(base +
  'application-ownership/application-ownership');
const { MysqlApplicationOwnership } = require(base +
  'application-ownership/mysql-application-ownership');
const { DnsOwnershipProof } = require(base +
  'application-ownership/dns-ownership-proof');
const { ApplicationOwnership1791676812000 } = require(base +
  'application-ownership/application-ownership.migration');
const { EditorialCommands } = require(base + 'application/editorial-commands');
const { MysqlEditorialWrites } = require(base +
  'infrastructure/mysql-editorial-writes');
const { projectEditorialSnapshot } = require(base +
  'application/editorial-materialization');

async function applicationOwnershipChecks({
  source,
  policy,
  reader,
  projections,
  pass,
  stopPolicy,
  qualifyHttp,
}) {
  const records = new Map();
  const queries = [];
  const server = createSocket('udp4');
  server.on('message', (query, address) => {
    let offset = 12;
    const labels = [];
    while (query[offset]) {
      const size = query[offset++];
      labels.push(query.subarray(offset, offset + size).toString());
      offset += size;
    }
    offset += 5;
    const name = labels.join('.');
    queries.push(name);
    const value = records.get(name);
    const header = Buffer.alloc(12);
    header.writeUInt16BE(query.readUInt16BE(0), 0);
    header.writeUInt16BE(0x8180, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(value === undefined ? 0 : 1, 6);
    const parts = [header, query.subarray(12, offset)];
    if (value !== undefined) {
      const bytes = Buffer.from(value);
      const answer = Buffer.alloc(13);
      answer.writeUInt16BE(0xc00c, 0);
      answer.writeUInt16BE(16, 2);
      answer.writeUInt16BE(1, 4);
      answer.writeUInt32BE(1, 6);
      answer.writeUInt16BE(bytes.length + 1, 10);
      answer.writeUInt8(bytes.length, 12);
      parts.push(answer, bytes);
    }
    server.send(Buffer.concat(parts), address.port, address.address);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.bind(0, '127.0.0.1', resolve);
  });
  try {
    const dnsPort = server.address().port;
    const proof = new DnsOwnershipProof(() => {
      const resolver = new Resolver({ timeout: 1000, tries: 1 });
      resolver.setServers(['127.0.0.1:' + dnsPort]);
      return resolver;
    });
    let now = Date.now();
    const random = {
      id: randomUUID,
      token: () => randomBytes(32).toString('hex'),
    };
    const store = new MysqlApplicationOwnership(source);
    const service = new ApplicationOwnership(
      store,
      proof,
      policy,
      random,
      () => now
    );
    const author = {
      identityId: 'CatalogAuthor',
      tenantId: 'default',
      roles: ['editorial:publisher'],
    };
    const owner = {
      identityId: 'VerifiedMaintainer',
      tenantId: 'default',
      roles: [],
    };
    const reviewer = {
      identityId: 'OwnershipReviewer',
      tenantId: 'default',
      roles: ['editorial:ownership-reviewer'],
    };
    const editorial = new EditorialCommands(
      new MysqlEditorialWrites(source, 'default'),
      policy,
      { generate: randomUUID }
    );
    const app = await editorial.create(
      'app',
      {
        name: 'Claimable Application',
        slug: 'claimable-application',
        website: 'https://app.example.test',
        description: 'A canonical application whose ownership can be proved.',
      },
      author,
      randomUUID()
    );
    const originalProjection = projectEditorialSnapshot(
      await reader.read('app', app.id)
    );
    await projections.publish(originalProjection);
    const outbox = async () =>
      Number(
        (
          await source.query('SELECT COUNT(*) AS total FROM editorial_outbox')
        )[0].total
      );
    const authority = async () => ({
      ...(
        await source.query(
          "SELECT ownerIdentityId, revision FROM editorial_resource_states WHERE resourceKind = 'app' AND resourceId = ?",
          [app.id]
        )
      )[0],
    });
    const initial = await outbox();
    const input = {
      applicationId: app.id,
      evidenceUrl: 'https://app.example.test/team',
      notes: 'I am responsible for this application and its official website.',
    };
    const createKey = randomUUID();
    const created = await service.create(owner, input, createKey);
    const id = created.id;
    assert.deepEqual(await service.create(owner, input, createKey), created);
    await assert.rejects(
      service.create(
        owner,
        { ...input, notes: input.notes + ' Changed.' },
        createKey
      ),
      /Idempotency/
    );
    assert.equal(await outbox(), initial);
    assert.equal((await service.read(owner, id)).hostname, 'app.example.test');
    for (const outsider of [
      { ...owner, identityId: 'Other' },
      { ...owner, identityId: 'verifiedmaintainer' },
      { ...owner, tenantId: 'other' },
    ])
      await assert.rejects(service.read(outsider, id), /not found/);
    await assert.rejects(
      service.change(
        { ...owner, roles: ['admin'] },
        id,
        'approve',
        { expectedRevision: 1 },
        randomUUID()
      ),
      /Permission/
    );
    await assert.rejects(
      service.change(
        { ...reviewer, roles: ['editorial:reviewer'] },
        id,
        'approve',
        { expectedRevision: 1 },
        randomUUID()
      ),
      /Permission/
    );
    pass(
      'canonical ownership claims persist with immutable challenge/receipt, owner/case/tenant isolation and dedicated independent reviewer authority'
    );

    const missingKey = randomUUID();
    const missing = await service.change(
      owner,
      id,
      'verify',
      { expectedRevision: 1 },
      missingKey
    );
    assert.equal(missing.proofMatched, false);
    assert.equal(missing.revision, 2);
    const priorQueries = queries.length;
    assert.deepEqual(
      await service.change(
        owner,
        id,
        'verify',
        { expectedRevision: 1 },
        missingKey
      ),
      missing
    );
    assert.equal(queries.length, priorQueries);
    await assert.rejects(
      service.change(
        owner,
        id,
        'verify',
        { expectedRevision: 2 },
        randomUUID()
      ),
      /30 seconds/
    );
    const pending = await service.read(owner, id);
    records.set(pending.challengeName, pending.challengeValue);
    now += 31000;
    const verified = await service.change(
      owner,
      id,
      'verify',
      { expectedRevision: 2 },
      randomUUID()
    );
    assert.equal(verified.status, 'awaiting-review');
    assert.equal(await outbox(), initial);
    assert.equal((await service.list(reviewer, true, 1)).items[0].id, id);
    pass(
      'real local DNS TXT lookup distinguishes missing proof, bounds repeat checks and replays completed verification without another network operation'
    );

    const before = await authority();
    const approveKey = randomUUID();
    await source.query(
      "CREATE TRIGGER fail_ownership_outbox BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected ownership outbox failure'"
    );
    try {
      await assert.rejects(
        service.change(
          reviewer,
          id,
          'approve',
          { expectedRevision: 3 },
          approveKey
        ),
        /Could not confirm/
      );
      assert.deepEqual(await authority(), before);
      assert.equal((await service.read(owner, id)).status, 'awaiting-review');
      assert.equal(
        (await source.query('SELECT * FROM application_ownership_grants'))
          .length,
        0
      );
      assert.equal(
        (await source.query('SELECT * FROM application_ownership_decisions'))
          .length,
        0
      );
      assert.equal(await outbox(), initial);
    } finally {
      await source.query('DROP TRIGGER fail_ownership_outbox');
    }
    const approved = await service.change(
      reviewer,
      id,
      'approve',
      { expectedRevision: 3 },
      approveKey
    );
    assert.equal(approved.applicationRevision, 2);
    assert.equal((await authority()).ownerIdentityId, owner.identityId);
    await assert.rejects(
      editorial.update(
        'app',
        app.id,
        { name: 'Stale author overwrite', expectedRevision: 2 },
        author,
        randomUUID()
      ),
      /Permission/
    );
    await projections.publish(
      projectEditorialSnapshot(await reader.read('app', app.id))
    );
    assert.equal(await projections.publish(originalProjection), 'superseded');
    assert.equal(await outbox(), initial + 1);
    pass(
      'approval atomically transfers canonical authority with decision history, receipt and outbox; stale projections cannot grant the previous author editing rights'
    );

    const independent = await new DataSource({
      ...source.options,
      migrationsRun: false,
    }).initialize();
    try {
      const reopened = new ApplicationOwnership(
        new MysqlApplicationOwnership(independent),
        proof,
        policy,
        random,
        () => now
      );
      assert.equal((await reopened.read(owner, id)).status, 'approved');
      assert.deepEqual(
        await reopened.change(
          reviewer,
          id,
          'approve',
          { expectedRevision: 3 },
          approveKey
        ),
        approved
      );
    } finally {
      await independent.destroy();
    }
    await source.query(
      "CREATE TRIGGER fail_ownership_revoke BEFORE INSERT ON editorial_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected revocation failure'"
    );
    try {
      await assert.rejects(
        service.change(
          reviewer,
          id,
          'revoke',
          { expectedRevision: 4, reason: 'Verification withdrawn' },
          randomUUID()
        ),
        /Could not confirm/
      );
      assert.equal((await service.read(owner, id)).status, 'approved');
      assert.equal(
        (
          await source.query(
            'SELECT revokedAt FROM application_ownership_grants WHERE applicationId = ?',
            [app.id]
          )
        )[0].revokedAt,
        null
      );
    } finally {
      await source.query('DROP TRIGGER fail_ownership_revoke');
    }
    const released = await service.change(
      owner,
      id,
      'release',
      { expectedRevision: 4 },
      randomUUID()
    );
    assert.equal(released.status, 'revoked');
    assert.equal(released.applicationRevision, 3);
    assert.deepEqual(
      await service.change(
        reviewer,
        id,
        'approve',
        { expectedRevision: 3 },
        approveKey
      ),
      approved
    );
    assert.notEqual(
      (
        await source.query(
          'SELECT revokedAt FROM application_ownership_grants WHERE applicationId = ?',
          [app.id]
        )
      )[0].revokedAt,
      null
    );
    assert.equal(
      (
        await source.query(
          'SELECT * FROM application_ownership_decisions WHERE claimId = ?',
          [id]
        )
      ).length,
      2
    );
    pass(
      'independent SQL connections recover approved claims; failed revocation rolls back and old approval replay cannot restore a released grant'
    );

    now += 31000;
    const contenders = ['ContenderA', 'ContenderB'].map((identityId) => ({
      ...owner,
      identityId,
    }));
    const contendersClaims = [];
    for (const contender of contenders) {
      const receipt = await service.create(contender, input, randomUUID());
      const claim = await service.read(contender, receipt.id);
      records.set(claim.challengeName, claim.challengeValue);
      await service.change(
        contender,
        claim.id,
        'verify',
        { expectedRevision: 1 },
        randomUUID()
      );
      contendersClaims.push(claim.id);
    }
    const decisions = await Promise.allSettled(
      contendersClaims.map((claimId) =>
        service.change(
          reviewer,
          claimId,
          'approve',
          { expectedRevision: 2 },
          randomUUID()
        )
      )
    );
    assert.equal(
      decisions.filter((result) => result.status === 'fulfilled').length,
      1
    );
    assert.equal(
      decisions.filter((result) => result.status === 'rejected').length,
      1
    );
    const winner = decisions.findIndex(
      (result) => result.status === 'fulfilled'
    );
    assert.equal(
      (await authority()).ownerIdentityId,
      contenders[winner].identityId
    );
    await service.change(
      reviewer,
      contendersClaims[winner],
      'revoke',
      {
        expectedRevision: 3,
        reason: 'Administrative revocation after race qualification',
      },
      randomUUID()
    );
    await service.change(
      contenders[1 - winner],
      contendersClaims[1 - winner],
      'cancel',
      { expectedRevision: 2 },
      randomUUID()
    );
    pass(
      'competing verified claims serialize against canonical authority so exactly one reviewer decision wins'
    );

    now += 31000;
    const recovering = await service.create(owner, input, randomUUID());
    const claim = await service.read(owner, recovering.id);
    records.set(claim.challengeName, claim.challengeValue);
    const command = {
      actor: owner,
      id: claim.id,
      key: randomUUID(),
      action: 'verify',
      input: { expectedRevision: 1, reason: '' },
      at: now,
    };
    command.fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          action: command.action,
          id: command.id,
          input: command.input,
        })
      )
      .digest('hex');
    const oldLease = random.token();
    await store.reserveCheck(command, oldLease);
    await assert.rejects(
      service.change(
        owner,
        claim.id,
        'verify',
        { expectedRevision: 1 },
        command.key
      ),
      /still in progress/
    );
    now += 15001;
    const newLease = random.token();
    await store.reserveCheck({ ...command, at: now }, newLease);
    await assert.rejects(
      store.finishCheck(command, oldLease, false, now),
      /lease expired/
    );
    const recovered = await store.finishCheck(command, newLease, true, now);
    assert.equal(recovered.proofMatched, true);
    assert.deepEqual(
      await service.change(
        owner,
        claim.id,
        'verify',
        { expectedRevision: 1 },
        command.key
      ),
      recovered
    );
    await editorial.update(
      'app',
      app.id,
      {
        name: 'Changed during ownership review',
        expectedRevision: Number((await authority()).revision),
      },
      { ...author, roles: ['editorial:moderator'] },
      randomUUID()
    );
    await assert.rejects(
      service.change(
        reviewer,
        claim.id,
        'approve',
        { expectedRevision: 2 },
        randomUUID()
      ),
      /application changed/
    );
    await service.change(
      reviewer,
      claim.id,
      'reject',
      {
        expectedRevision: 2,
        reason: 'Canonical application changed; submit current evidence.',
      },
      randomUUID()
    );
    pass(
      'interrupted DNS reservations recover with bounded leases; stale completions are fenced and changed canonical content invalidates approval'
    );

    const boundedOwner = { ...owner, identityId: 'BoundedChecks' };
    const boundedClaim = await service.create(
      boundedOwner,
      input,
      randomUUID()
    );
    const boundedCommand = {
      ...command,
      actor: boundedOwner,
      id: boundedClaim.id,
      key: randomUUID(),
      at: now,
    };
    boundedCommand.fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          action: 'verify',
          id: boundedClaim.id,
          input: boundedCommand.input,
        })
      )
      .digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      await store.reserveCheck({ ...boundedCommand, at: now }, random.token());
      now += 15001;
    }
    await assert.rejects(
      store.reserveCheck({ ...boundedCommand, at: now }, random.token()),
      /exhausted recovery/
    );
    let boundedRevision = 1;
    for (let attempt = 3; attempt < 10; attempt++) {
      now += 31000;
      const result = await service.change(
        boundedOwner,
        boundedClaim.id,
        'verify',
        { expectedRevision: boundedRevision },
        randomUUID()
      );
      assert.equal(result.proofMatched, false);
      boundedRevision = result.revision;
    }
    now += 31000;
    const queryCount = queries.length;
    await assert.rejects(
      service.change(
        boundedOwner,
        boundedClaim.id,
        'verify',
        { expectedRevision: boundedRevision },
        randomUUID()
      ),
      /exhausted its domain checks/
    );
    assert.equal(queries.length, queryCount);
    pass(
      'each verification intent has at most three lease executions and the persistent challenge limit prevents further DNS work after ten checks'
    );

    const migrate = async () => {
      const runner = source.createQueryRunner();
      try {
        await new ApplicationOwnership1791676812000().up(runner);
      } finally {
        await runner.release();
      }
    };
    await migrate();
    const [stored] = await source.query(
      'SELECT receipt FROM application_ownership_commands WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      ['default', owner.identityId, createKey]
    );
    const serialized =
      typeof stored.receipt === 'string'
        ? stored.receipt
        : JSON.stringify(stored.receipt);
    await source.query(
      'UPDATE application_ownership_commands SET receipt = ? WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
      ['{}', 'default', owner.identityId, createKey]
    );
    try {
      await assert.rejects(migrate);
    } finally {
      await source.query(
        'UPDATE application_ownership_commands SET receipt = ? WHERE tenantId = ? AND actorIdentityId = ? AND commandKey = ?',
        [serialized, 'default', owner.identityId, createKey]
      );
    }
    await migrate();
    pass(
      'additive ownership migration preserves decisions, leases and tombstones on reentry and refuses corrupted receipts'
    );
    await require('./application-ownership-authoring-checks.cjs').applicationOwnershipAuthoringChecks(
      {
        source,
        policy,
        ownership: service,
        records,
        now: () => now,
        pass,
      }
    );
    await migrate();
    const afterPolicyStop = qualifyHttp
      ? await qualifyHttp({ dnsServer: '127.0.0.1:' + dnsPort, records })
      : null;
    await stopPolicy();
    if (afterPolicyStop) await afterPolicyStop();
    const unchanged = await outbox();
    await assert.rejects(
      service.create(
        { ...owner, identityId: 'OfflinePolicy' },
        input,
        randomUUID()
      ),
      /authorization is unavailable/
    );
    assert.equal(await outbox(), unchanged);
    pass('OPA outage fails closed without ownership or materialization writes');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
module.exports = { applicationOwnershipChecks };
