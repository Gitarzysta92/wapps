const { randomUUID } = require('node:crypto');

// Inventory qualifications scan whole buckets. An isolated SQL database is insufficient.
async function claimFreshObjectStore(store) {
  const message =
    'Discussion qualification requires a fresh dedicated object store. Run qualify-materialization.cjs; never use the application object store.';
  if ((await store.listBuckets()).length) throw new Error(message);
  const marker = `wapps-qualification-${randomUUID()}`;
  await store.createBucket(marker);
  try {
    const buckets = await store.listBuckets();
    if (buckets.length !== 1 || buckets[0] !== marker) throw new Error(message);
  } catch (error) {
    await store.deleteBucket(marker);
    throw error;
  }
  return () => store.deleteBucket(marker);
}

module.exports = { claimFreshObjectStore };
