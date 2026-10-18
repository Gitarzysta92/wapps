const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const {
  CreateBucketCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { profileParityContent } = require('./profile-parity-content.cjs');
const {
  applicationImageObjectKey,
} = require('../../apps/services/editorial/src/app/application-media/s3-application-images');

module.exports = async function erasureFixtures({
  call,
  at,
  owner,
  other,
  operator,
  services,
  source,
  ingressSecret,
  until,
}) {
  const bucket = 'erasure-media';
  await services.storage.send(new CreateBucketCommand({ Bucket: bucket }));
  await services.restartEditorial({
    EDITORIAL_MEDIA_ENDPOINT: services.discussionEnv.DISCUSSION_STORAGE_HOST,
    EDITORIAL_MEDIA_BUCKET: bucket,
    EDITORIAL_MEDIA_PUBLIC_ORIGIN: 'https://erasure.example.test',
    EDITORIAL_MEDIA_ACCESS_KEY:
      services.discussionEnv.DISCUSSION_STORAGE_ACCESSKEY,
    EDITORIAL_MEDIA_SECRET_KEY:
      services.discussionEnv.DISCUSSION_STORAGE_SECRETKEY,
  });
  const bytes = await sharp({
    create: { width: 320, height: 180, channels: 3, background: '#277d74' },
  })
    .png()
    .toBuffer();
  const headers = {
    'X-Ingress-Auth': ingressSecret,
    'X-User-Id': owner.uid,
    'X-User-Claims': JSON.stringify({ roles: [], tenantId: 'default' }),
  };
  let retained, privateImage;
  async function upload(draftId, editorial) {
    const reserved = await editorial('me/application-images', {
      status: 201,
      body: {
        draftId,
        purpose: 'logo',
        source: {
          contentType: 'image/png',
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      },
    });
    const response = await fetch(
      services.endpoints.EDITORIAL_URL +
        '/api/me/application-images/' +
        reserved.id +
        '/content',
      {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'If-Match': '"1"',
          'Idempotency-Key': randomUUID(),
        },
        body: bytes,
        signal: AbortSignal.timeout(20000),
      }
    );
    assert.equal(response.status, 200, await response.clone().text());
    const image = await response.json();
    assert.equal(image.status, 'ready');
    return image;
  }
  const content = await profileParityContent({
    call,
    at,
    owner,
    operator,
    services,
    ingressSecret,
    checkLag: false,
    prepareApplication: async (application, editorial) => {
      retained = await upload(application.id, editorial);
      await editorial(`me/application-drafts/${application.id}/images`, {
        method: 'PUT',
        body: {
          imageId: retained.id,
          purpose: 'logo',
          expectedRevision: application.revision,
        },
      });
      const draft = await editorial('me/application-drafts', {
        status: 201,
        body: {
          name: 'Private erasure draft',
          slug: 'private-' + randomUUID(),
          website: 'https://private.example.test',
          description: 'Private account content',
        },
      });
      privateImage = await upload(draft.id, editorial);
    },
  });
  // Stop and await this materializer before the legacy helper controls projection lag.
  await services.stopWorker();
  const own = (route, options = {}) =>
    call(route, { at, token: owner.token, ...options });
  const command = (route, token, body) =>
    call(route, {
      at,
      token,
      method: 'PUT',
      headers: { 'Idempotency-Key': randomUUID() },
      body,
    });
  const preferences = await own('/api/me/preferences');
  preferences.preferences.privacy.profileVisibility = 'followers';
  await command('/api/me/preferences', owner.token, {
    expectedRevision: preferences.revision,
    preferences: preferences.preferences,
  });
  const foreignSuite = await call('/api/me/suites', {
    at,
    token: other.token,
    status: 201,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      title: 'Peer private suite',
      description: 'Preserved private state',
      classification: 'general',
      applicationIds: [content.application.id],
    },
  });
  const foreignSuiteBefore = await call('/api/me/suites/' + foreignSuite.id, {
    at,
    token: other.token,
  });
  await own('/api/me/suites', {
    status: 201,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      title: 'Private erasure suite',
      description: 'Private history',
      classification: 'general',
      applicationIds: [content.application.id],
    },
  });
  await own('/api/me/suites/' + content.suite.id, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': randomUUID() },
    body: { expectedRevision: 3 },
  });
  const publicSuite = await call('/api/catalog/suites/' + content.suite.id, {
    at,
  });
  const privateTopic = await own('/api/discussions', {
    status: 201,
    headers: { 'Idempotency-Key': randomUUID() },
    body: {
      content: 'Historical private erasure text',
      state: 'draft',
      visibility: 'private',
    },
  });
  await command('/api/discussions/' + privateTopic.id, owner.token, {
    content: 'Current private erasure text',
    expectedRevision: privateTopic.revision,
  });
  const profile = await own('/api/me/profile');
  await command('/api/me/profile', owner.token, {
    expectedRevision: profile.revision,
    name: 'Erased owner',
    bio: 'Private biography',
    location: 'Warsaw',
    socialLinks: {},
    contactEmail: owner.email,
  });
  const avatar = await fetch(at + '/api/me/profile/avatar', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + owner.token,
      'Content-Type': 'image/png',
      'If-Match': `"${(await own('/api/me/profile')).revision}"`,
      'Idempotency-Key': randomUUID(),
      'X-Avatar-Bytes': String(bytes.length),
      'X-Avatar-Sha256': createHash('sha256').update(bytes).digest('hex'),
    },
    body: bytes,
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(avatar.status, 200, await avatar.text());
  const follow = {
    ownerId: owner.publicId,
    requesterId: other.publicId,
    expectedRevision: 0,
    action: 'request',
  };
  await command('/api/me/profile-follows', other.token, follow);
  await command('/api/me/profile-follows', owner.token, {
    ...follow,
    expectedRevision: 1,
    action: 'approve',
  });
  const award = {
    expectedRevision: 0,
    kind: 'verified',
    action: 'award',
    reason: 'Private staff evidence',
  };
  await command(
    '/api/admin/profile-badges/' + owner.publicId,
    operator.token,
    award
  );
  await command(
    '/api/admin/profile-badges/' + other.publicId,
    owner.token,
    award
  );
  // Seed historical delivered/suppressed receipts; worker delivery itself is qualified in A26.
  for (const member of [owner, other]) {
    for (const [table, column] of [
      ['identity_reply_notifications', 'parentId'],
      ['identity_mention_notifications', 'nodeId'],
    ])
      await source.query(
        `INSERT INTO ${table} (identityId,id,discussionId,${column},revision,createdAt,receivedAt,delivered,readAt) VALUES (?,?,?,?,2,?,?,1,NULL)`,
        [
          member.uid,
          randomUUID(),
          content.topic.id,
          content.topic.id,
          Date.now(),
          Date.now(),
        ]
      );
    await source.query(
      'INSERT INTO identity_favorite_notifications (identityId,id,generation,targetKind,targetId,version,sourceAt,createdAt,delivered,readAt) VALUES (?,?,?,?,?,1,?,?,0,NULL)',
      [
        member.uid,
        randomUUID(),
        randomUUID(),
        'applications',
        content.application.id,
        Date.now(),
        Date.now(),
      ]
    );
  }
  const foreignReceipts = await source.query(
    'SELECT * FROM identity_reply_notifications WHERE identityId=?',
    [other.uid]
  );
  const exportJob = await own('/api/me/exports', {
    status: 202,
    body: {},
    headers: { 'Idempotency-Key': randomUUID() },
  });
  await until(
    () => own('/api/me/exports/' + exportJob.id),
    (job) => job.status === 'ready',
    'Pre-erasure archive did not finish'
  );
  assert.ok(
    Number(
      (
        await source.query(
          'SELECT COUNT(*) AS total FROM identity_account_export_chunks WHERE exportId=?',
          [exportJob.id]
        )
      )[0].total
    ) > 0
  );
  const object = (id) =>
    services.storage.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: applicationImageObjectKey(id),
      })
    );
  const retainedObject = await object(retained.id);
  assert.ok((await object(privateImage.id)).ContentLength > 0);
  return {
    content,
    async verify(until) {
      for (const table of [
        'identity_accounts',
        'identity_preferences',
        'identity_profile_avatars',
        'identity_account_commands',
        'identity_favorites',
        'identity_favorite_watches',
        'identity_reply_notifications',
        'identity_mention_notifications',
        'identity_favorite_notifications',
        'identity_account_exports',
      ])
        assert.deepEqual(
          await source.query(`SELECT 1 FROM ${table} WHERE identityId=?`, [
            owner.uid,
          ]),
          [],
          table
        );
      assert.deepEqual(
        await source.query(
          'SELECT 1 FROM identity_account_export_chunks WHERE exportId=?',
          [exportJob.id]
        ),
        []
      );
      for (const table of [
        'identity_profile_follows',
        'identity_profile_follow_commands',
      ])
        assert.deepEqual(
          await source.query(
            `SELECT 1 FROM ${table} WHERE ownerId=? OR requesterId=?`,
            [owner.publicId, owner.publicId]
          ),
          []
        );
      assert.deepEqual(
        await source.query(
          'SELECT 1 FROM identity_profile_badge_events WHERE ownerId=? OR actorId=?',
          [owner.publicId, owner.publicId]
        ),
        []
      );
      const [preservedAward] = await source.query(
        'SELECT actorId,reason,commandKey,fingerprint FROM identity_profile_badge_events WHERE ownerId=?',
        [other.publicId]
      );
      assert.deepEqual(preservedAward, {
        actorId: null,
        reason: null,
        commandKey: null,
        fingerprint: null,
      });
      assert.deepEqual(
        await source.query(
          'SELECT * FROM identity_reply_notifications WHERE identityId=?',
          [other.uid]
        ),
        foreignReceipts
      );
      const scrubbedSuite = await call(
        '/api/catalog/suites/' + content.suite.id,
        { at }
      );
      assert.equal(scrubbedSuite.title, publicSuite.title);
      assert.equal(scrubbedSuite.description, publicSuite.description);
      assert.ok(!JSON.stringify(scrubbedSuite).includes(owner.uid));
      const peerSuite = await call('/api/me/suites/' + foreignSuite.id, {
        at,
        token: other.token,
      });
      assert.deepEqual(peerSuite, foreignSuiteBefore);
      await until(
        () => object(privateImage.id),
        (value) => value.ContentLength === 0,
        'Private image bytes were not retired'
      );
      assert.equal(
        (await object(privateImage.id)).ContentType,
        'application/x-wapps-retired-image'
      );
      assert.equal((await object(retained.id)).ETag, retainedObject.ETag);
      assert.equal(
        (await object(retained.id)).ContentLength,
        retainedObject.ContentLength
      );
      assert.deepEqual(
        await services.editorialSource.query(
          'SELECT 1 FROM application_image_uploads WHERE ownerIdentityId=?',
          [owner.uid]
        ),
        []
      );
    },
  };
};
