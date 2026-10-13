const { S3Client, HeadBucketCommand, CreateBucketCommand, GetBucketVersioningCommand, GetBucketLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');

async function main() {
  const client = new S3Client({
    endpoint: process.env.EDITORIAL_MEDIA_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.EDITORIAL_MEDIA_ACCESS_KEY,
      secretAccessKey: process.env.EDITORIAL_MEDIA_SECRET_KEY,
    },
  });
  const Bucket = process.env.EDITORIAL_MEDIA_BUCKET;
  if (!Bucket) throw new Error('EDITORIAL_MEDIA_BUCKET is required');
  try {
    await client.send(new HeadBucketCommand({ Bucket }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
    await client.send(new CreateBucketCommand({ Bucket }));
  }
  const versioning = await client.send(new GetBucketVersioningCommand({ Bucket }));
  if (versioning.Status) throw new Error('Application image bucket must never be versioned');
  try {
    const lifecycle = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket }));
    if (lifecycle.Rules?.length) throw new Error('Application image lifecycle deletion must be disabled');
  } catch (error) {
    if (error.name !== 'NoSuchLifecycleConfiguration') throw error;
  }
  console.log('Private application image storage is provisioned and validated');
  client.destroy();
}

main().catch(() => {
  console.error('Storage provisioning failed; inspect bucket configuration and credentials');
  process.exitCode = 1;
});
