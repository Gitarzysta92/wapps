/* Read-only collection from stopped-writer legacy stores; output contains private data. */
const { writeFile } = require('node:fs/promises');
const { createConnection } = require('mysql2/promise');
const { MongoClient } = require('mongodb');

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--output')
    throw new Error('Expected --output <new-private-evidence-file>');
  const required = (key) => {
    const value = process.env[key];
    if (!value?.trim()) throw new Error(`${key} is required`);
    return value;
  };
  const database = required('LEGACY_MYSQL_DATABASE');
  const port = Number(required('LEGACY_MYSQL_PORT'));
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !/^[A-Za-z0-9_]{1,64}$/.test(database)
  )
    throw new Error('Invalid legacy SQL configuration');
  const mongo = new MongoClient(required('LEGACY_MONGO_URI'), {
    serverSelectionTimeoutMS: 10000,
  });
  const mongoDatabase = required('LEGACY_MONGO_DATABASE');
  const sql = await createConnection({
    host: required('LEGACY_MYSQL_HOST'),
    port,
    user: required('LEGACY_MYSQL_USERNAME'),
    password: required('LEGACY_MYSQL_PASSWORD'),
    database,
    connectTimeout: 10000,
  });
  try {
    await sql.query('SET TRANSACTION READ ONLY');
    await sql.beginTransaction();
    const [subjects] = await sql.query(
      'SELECT id, provider, externalId, identityId, createdAt, updatedAt, deletedAt FROM identity_subjects ORDER BY BINARY id LIMIT 1001'
    );
    await mongo.connect();
    const db = mongo.db(mongoDatabase);
    const collections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();
    if (
      collections.some(
        ({ name }) => !['identity_nodes', 'accounts', 'profiles'].includes(name)
      )
    )
      throw new Error(
        'Legacy Identity contains additional collections requiring review'
      );
    const result = {};
    for (const [key, name] of [
      ['nodes', 'identity_nodes'],
      ['accounts', 'accounts'],
      ['profiles', 'profiles'],
    ]) {
      result[key] = await db
        .collection(name)
        .find({})
        .limit(1001)
        .maxTimeMS(10000)
        .toArray();
      for (const row of result[key])
        if (row._id?.toHexString) row._id = row._id.toHexString();
    }
    if ([subjects, ...Object.values(result)].some((rows) => rows.length > 1000))
      throw new Error('Legacy evidence exceeds the 1000-record bound');
    await sql.commit();
    await writeFile(
      process.argv[3],
      JSON.stringify(
        {
          sourceDatabase: database,
          capturedAt: Date.now(),
          subjects,
          ...result,
        },
        null,
        2
      ) + '\n',
      { flag: 'wx', mode: 0o600 }
    );
    console.log(
      JSON.stringify({
        subjects: subjects.length,
        nodes: result.nodes.length,
        accounts: result.accounts.length,
        profiles: result.profiles.length,
      })
    );
  } finally {
    await sql.end();
    await mongo.close();
  }
}

main().catch(() => {
  console.error(
    'Legacy evidence collection failed; check source configuration, bounds and output path'
  );
  process.exitCode = 1;
});
