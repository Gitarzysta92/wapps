const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function qualifyArticleComments({
  request,
  change,
  until,
  origins,
  services,
  author,
  other,
  foreign,
  id,
}) {
  const base = '/api/article-comments/' + id;
  const content = {
    displayName: 'Public article reader',
    text: 'A durable article comment.',
  };
  const key = randomUUID();
  const created = await Promise.all(
    origins.map((at) => change(base, author, content, { at, key }))
  );
  assert.deepEqual(created[0], created[1]);
  const root = created[0];
  assert.equal(root.projection, 'pending');
  await request(`${base}/${root.id}`, { status: 503 });
  await change(
    base,
    author,
    { ...content, text: 'Changed intent' },
    { key, status: 409 }
  );
  await services.restartCommunity();
  assert.deepEqual(await change(base, author, content, { key }), root);
  await services.startDiscussionWorker();
  const projected = async (revision) =>
    until(async () => {
      services.assertDiscussionWorker();
      const thread = await request(`${base}/${root.id}`, { actor: author });
      assert.equal(thread.revision, revision);
      return thread;
    }, 'Discussion generation did not converge');
  const initial = await projected(1);
  assert.equal(initial.comments[0].content.text, content.text);
  assert.equal(initial.comments[0].editable, true);
  const anonymous = await request(`${base}/${root.id}`, { at: origins[1] });
  assert.equal(anonymous.comments[0].editable, false);
  assert.ok(!JSON.stringify(anonymous).includes(author.uid));
  assert.equal((await request(base)).items[0].id, root.id);
  await change(base, null, content, { status: 401 });
  await request(base, { actor: foreign, status: 404 });
  await change(base, foreign, content, { status: 404 });
  await change(
    base,
    author,
    { ...content, ownerIdentityId: other.uid },
    { status: 400 }
  );
  await request(base + '?bindingKey=forged', { actor: author, status: 400 });
  await request(`/api/discussions/${root.id}`, { actor: author, status: 404 });
  await request(`/api/discussions/${root.id}?bindingKey=article:${id}`, {
    actor: author,
    status: 400,
  });
  await request(`/api/article-comments/${randomUUID()}/${root.id}`, {
    actor: author,
    status: 404,
  });
  await change(
    `${base}/${root.id}`,
    other,
    { content, expectedRevision: 1 },
    { method: 'PUT', status: 403 }
  );
  const reply = await change(
    `${base}/${root.id}/replies`,
    other,
    {
      ...content,
      displayName: 'Independent reader',
      text: 'Reply from a second session.',
    },
    { at: origins[1] }
  );
  await projected(reply.revision);
  await change(
    `${base}/${root.id}`,
    author,
    { content, expectedRevision: 1 },
    { method: 'PUT', status: 409 }
  );
  const edit = await change(
    `${base}/${root.id}`,
    author,
    {
      content: { ...content, text: 'Edited root' },
      expectedRevision: reply.revision,
    },
    { method: 'PUT' }
  );
  await projected(edit.revision);
  const removeKey = randomUUID(),
    removeBody = { expectedRevision: edit.revision };
  const removed = await change(`${base}/${reply.id}`, other, removeBody, {
    method: 'DELETE',
    key: removeKey,
  });
  const redacted = await projected(removed.revision);
  assert.equal(
    redacted.comments.find((item) => item.id === reply.id).content,
    null
  );
  assert.deepEqual(
    await change(`${base}/${reply.id}`, other, removeBody, {
      method: 'DELETE',
      key: removeKey,
    }),
    removed
  );

  const totals = async () =>
    (
      await services.discussionSql.query(
        'SELECT (SELECT COUNT(*) FROM discussion_write_aggregates) roots, (SELECT COUNT(*) FROM discussion_commands) commands, (SELECT COUNT(*) FROM discussion_outbox) outbox'
      )
    )[0];
  const before = await totals(),
    rollbackKey = randomUUID();
  await services.discussionSql.query(
    "CREATE TRIGGER article_comment_receipt_failure BEFORE INSERT ON discussion_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'article comment rollback'"
  );
  try {
    await change(base, author, content, { key: rollbackKey, status: 503 });
  } finally {
    await services.discussionSql.query(
      'DROP TRIGGER article_comment_receipt_failure'
    );
  }
  assert.deepEqual(await totals(), before);
  await change(base, author, content, { key: rollbackKey });
  console.log(
    'PASS article comments: generic Discussion binding, current parent authority without an article projection, broker delivery, immutable payloads, concurrent replay, independent sessions, tenant/keyless/forged-scope denial, edits/replies/redaction and SQL/outbox rollback'
  );
  return {
    root,
    base,
    content,
    async assertHidden() {
      for (const at of origins) {
        await request(base, { at, status: 404 });
        await request(`${base}/${root.id}`, { at, actor: author, status: 404 });
        await change(base, author, content, { at, status: 404 });
        await change(`${base}/${root.id}/replies`, other, content, {
          at,
          status: 404,
        });
      }
    },
    async assertVisible() {
      return projected(removed.revision);
    },
  };
}

module.exports = { qualifyArticleComments };
