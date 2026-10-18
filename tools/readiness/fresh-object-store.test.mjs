import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimFreshObjectStore } from './fresh-object-store.cjs';

function store(initial = []) {
  const buckets = new Set(initial);
  const changes = [];
  return {
    buckets,
    changes,
    async listBuckets() {
      return [...buckets];
    },
    async createBucket(name) {
      changes.push(['create', name]);
      buckets.add(name);
    },
    async deleteBucket(name) {
      changes.push(['delete', name]);
      buckets.delete(name);
    },
  };
}

test('existing object stores are rejected before any mutation, including empty application buckets', async () => {
  for (const initial of [['discussion-content'], ['unrelated-data']]) {
    const existing = store(initial);
    await assert.rejects(
      claimFreshObjectStore(existing),
      /fresh dedicated object store/
    );
    assert.deepEqual(existing.changes, []);
    assert.deepEqual([...existing.buckets], initial);
  }
});

test('a fresh store is claimed and cleanup removes only its ownership marker', async () => {
  const fresh = store();
  const release = await claimFreshObjectStore(fresh);
  const [marker] = fresh.buckets;
  assert.match(marker, /^wapps-qualification-/);
  fresh.buckets.add('discussion-content');
  await release();
  assert.deepEqual([...fresh.buckets], ['discussion-content']);
  assert.deepEqual(fresh.changes, [
    ['create', marker],
    ['delete', marker],
  ]);
});

test('racing store claims fail closed and preserve the other claimant', async () => {
  const racing = store();
  const create = racing.createBucket.bind(racing);
  racing.createBucket = async (name) => {
    await create(name);
    racing.buckets.add('another-qualification');
  };
  await assert.rejects(
    claimFreshObjectStore(racing),
    /fresh dedicated object store/
  );
  assert.deepEqual([...racing.buckets], ['another-qualification']);
  assert.equal(racing.changes.length, 2);
  assert.equal(racing.changes[0][1], racing.changes[1][1]);
});

test('unavailable bucket listings never authorize a qualification', async () => {
  const unavailable = store();
  unavailable.listBuckets = async () => {
    throw new Error('unavailable');
  };
  await assert.rejects(claimFreshObjectStore(unavailable), /unavailable/);
  assert.deepEqual(unavailable.changes, []);
});
