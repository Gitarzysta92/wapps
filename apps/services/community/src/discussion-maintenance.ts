import { DiscussionBindingIndex1792150000000 } from './app/discussions/infrastructure/discussion-binding-index.migration';
import { CommunityDiscussionBindingKeys1792080000000 } from './app/discussions/infrastructure/discussion-binding-keys.migration';
import { MysqlMentionNotifications } from './app/discussions/infrastructure/mysql-mention-notifications';
import { DiscussionContentUpdates1791840018000 } from './app/discussions/infrastructure/content-update-cursors.migration';
import {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} from '@wapps/account-mysql';
import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { DataSource } from 'typeorm';
import { MinioClient } from '@sdk/extras/minio';
import { LegacyDiscussionBackfill } from './app/discussions/application/legacy-discussion-backfill';
import { MinioDiscussionPayloadObjects } from './app/discussions/infrastructure/immutable-discussion-payloads';
import { RegisteredDiscussionPayloads } from './app/discussions/application/registered-discussion-payloads';
import { MysqlDiscussionPayloads } from './app/discussions/infrastructure/mysql-discussion-payloads';
import { DiscussionPayloads1791840004000 } from './app/discussions/infrastructure/discussion-payloads.migration';
import { DiscussionPayloadInventory1791840005000 } from './app/discussions/infrastructure/discussion-payload-inventory.migration';
import { DiscussionAuthorErasure1791840006000 } from './app/discussions/infrastructure/discussion-author-erasure.migration';
import { DiscussionPrivateErasure1791840007000 } from './app/discussions/infrastructure/discussion-private-erasure.migration';
import { ReviewErasure1791840008000 } from './app/reviews/infrastructure/review-erasure.migration';
import { ReplyNotifications1791840015000 } from './app/discussions/infrastructure/reply-notifications.migration';
import { MentionNotifications1791864016000 } from './app/discussions/infrastructure/mention-notifications.migration';
import { InventoryDiscussionPayloads } from './app/discussions/application/discussion-payload-inventory';
import { MysqlDiscussionPayloadInventory } from './app/discussions/infrastructure/mysql-discussion-payload-inventory';
import { MinioDiscussionPayloadInventory } from './app/discussions/infrastructure/minio-discussion-payload-inventory';
import { MinioLegacyDiscussionPayloads } from './app/discussions/infrastructure/legacy-discussion-payloads';
import { MysqlDiscussionBackfill } from './app/discussions/infrastructure/mysql-discussion-backfill';
import { DiscussionWriteModel1791676800000 } from './app/discussions/infrastructure/discussion-write-model.migration';
import { DiscussionBackfill1791676801000 } from './app/discussions/infrastructure/discussion-backfill.migration';
import { DiscussionArticleTargets1791676822000 } from './app/discussions/infrastructure/discussion-article-targets.migration';
import { DiscussionApplicationTargets1791676823000 } from './app/discussions/infrastructure/discussion-application-targets.migration';
import { DiscussionParticipation1791676824000 } from './app/discussions/infrastructure/discussion-participation.migration';
import { DiscussionVotes1791676825000 } from './app/discussions/infrastructure/discussion-votes.migration';
import { DiscussionPins1791676826000 } from './app/discussions/infrastructure/discussion-pins.migration';
import { MemberReviews1791676827000 } from './app/reviews/infrastructure/member-reviews.migration';
import { MysqlReplyNotifications } from './app/discussions/infrastructure/mysql-reply-notifications';
import { publicCommentId } from '@domains/community';

export function parseMaintenanceArguments(args: string[]):
  | { mode: 'migrate' }
  | { mode: 'notification-status' }
  | { mode: 'mention-status' }
  | { mode: 'mention-requeue'; id: string; failedAt: number }
  | { mode: 'notification-requeue'; id: string; failedAt: number }
  | { mode: 'inventory'; apply: string | null; legacyWritersStopped: boolean }
  | {
      mode: 'backfill';
      manifest: string;
      apply: string | null;
      legacyWritersStopped: boolean;
    } {
  if (args.length === 1 && args[0] === '--migrate') return { mode: 'migrate' };
  if (args.length === 1 && args[0] === '--notification-status')
    return { mode: 'notification-status' };
  if (
    args.length === 4 &&
    args[0] === '--notification-requeue' &&
    args[2] === '--failed-at'
  ) {
    const id = publicCommentId(args[1]),
      failedAt = Number(args[3]);
    if (
      !Number.isSafeInteger(failedAt) ||
      failedAt < 1 ||
      String(failedAt) !== args[3]
    )
      throw new Error('Invalid failed notification receipt');
    return { mode: 'notification-requeue', id, failedAt };
  }
  if (args.length === 1 && args[0] === '--mention-status')
    return { mode: 'mention-status' };
  if (args[0] === '--mention-requeue') {
    const parsed = parseMaintenanceArguments([
      '--notification-requeue',
      ...args.slice(1),
    ]);
    if (parsed.mode !== 'notification-requeue')
      throw new Error('Invalid mention requeue');
    return { ...parsed, mode: 'mention-requeue' };
  }
  const inventory = args[0] === '--inventory-payloads';
  if (args[0] !== '--backfill' && !inventory)
    throw new Error(
      'Expected --migrate, --inventory-payloads or --backfill --manifest <file> [--apply <plan-fingerprint> --legacy-writers-stopped]'
    );
  let manifest: string | null = null;
  let apply: string | null = null;
  let legacyWritersStopped = false;
  for (let index = 1; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--legacy-writers-stopped' && !legacyWritersStopped)
      legacyWritersStopped = true;
    else if (
      (arg === '--manifest' && !inventory && manifest === null) ||
      (arg === '--apply' && apply === null)
    ) {
      const value = args[++index];
      if (!value || value.startsWith('--'))
        throw new Error(`Missing value for ${arg}`);
      if (arg === '--manifest') manifest = value;
      else apply = value;
    } else throw new Error(`Unknown or duplicate maintenance argument: ${arg}`);
  }
  if (
    (!inventory && !manifest) ||
    (apply !== null &&
      (!/^[a-f0-9]{64}$/.test(apply) || !legacyWritersStopped)) ||
    (apply === null && legacyWritersStopped)
  )
    throw new Error(
      'Backfill requires a manifest; applying requires a reviewed fingerprint and --legacy-writers-stopped'
    );
  if (inventory) return { mode: 'inventory', apply, legacyWritersStopped };
  if (manifest === null) throw new Error('Missing ownership manifest');
  return { mode: 'backfill', manifest, apply, legacyWritersStopped };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}

async function readManifest(path: string): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 1024 * 1024) throw new Error('Ownership manifest exceeds 1 MiB');
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function runDiscussionMaintenance(args: string[]): Promise<void> {
  const options = parseMaintenanceArguments(args);
  const input =
    options.mode === 'backfill' ? await readManifest(options.manifest) : null;
  const port = Number(required('DISCUSSION_DATABASE_PORT'));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid discussion database port');
  const db = new DataSource({
    type: 'mysql',
    host: required('DISCUSSION_DATABASE_HOST'),
    port,
    username: required('DISCUSSION_DATABASE_USERNAME'),
    password: required('DISCUSSION_DATABASE_PASSWORD'),
    database: required('DISCUSSION_DATABASE_NAME'),
    synchronize: false,
    migrationsRun: false,
    migrations: [
      DiscussionWriteModel1791676800000,
      DiscussionBackfill1791676801000,
      DiscussionArticleTargets1791676822000,
      DiscussionApplicationTargets1791676823000,
      DiscussionParticipation1791676824000,
      DiscussionVotes1791676825000,
      DiscussionPins1791676826000,
      MemberReviews1791676827000,
      IdentityWriteBarrier1791840000000,
      AccountErasureRequests1791840001000,
      DiscussionPayloads1791840004000,
      DiscussionPayloadInventory1791840005000,
      DiscussionAuthorErasure1791840006000,
      DiscussionPrivateErasure1791840007000,
      ReviewErasure1791840008000,
      ReplyNotifications1791840015000,
      MentionNotifications1791864016000,
      DiscussionContentUpdates1791840018000,
      CommunityDiscussionBindingKeys1792080000000,
      DiscussionBindingIndex1792150000000,
    ],
    migrationsTransactionMode: 'each',
    logging: false,
  });
  try {
    await db.initialize();
    if (options.mode === 'migrate') {
      const migrations = await db.runMigrations({ transaction: 'each' });
      console.log(
        JSON.stringify({
          migrated: migrations.map((migration) => migration.name),
        })
      );
      return;
    }
    if (
      options.mode === 'notification-status' ||
      options.mode === 'notification-requeue' ||
      options.mode === 'mention-status' ||
      options.mode === 'mention-requeue'
    ) {
      if (await db.showMigrations())
        throw new Error(
          'Run Discussion --migrate before notification maintenance'
        );
      const notifications = options.mode.startsWith('mention-')
        ? new MysqlMentionNotifications(db)
        : new MysqlReplyNotifications(db);
      if (
        options.mode === 'notification-status' ||
        options.mode === 'mention-status'
      )
        console.log(JSON.stringify(await notifications.status()));
      else {
        if (!(await notifications.requeue(options.id, options.failedAt)))
          throw new Error('Notification failure receipt no longer matches');
        console.log(JSON.stringify({ requeued: options.id }));
      }
      return;
    }
    const minio = new MinioClient({
      host: required('DISCUSSION_STORAGE_HOST'),
      accessKey: required('DISCUSSION_STORAGE_ACCESSKEY'),
      secretKey: required('DISCUSSION_STORAGE_SECRETKEY'),
    });
    if (options.mode === 'inventory') {
      const inventory = new InventoryDiscussionPayloads(
        new MysqlDiscussionPayloadInventory(db),
        new MinioDiscussionPayloadInventory(minio)
      );
      console.log(
        JSON.stringify(
          options.apply === null
            ? { status: 'planned', ...(await inventory.plan()) }
            : {
                status: 'applied',
                progress: await inventory.apply(
                  options.apply,
                  options.legacyWritersStopped
                ),
              }
        )
      );
      return;
    }
    const backfill = new LegacyDiscussionBackfill(
      new MysqlDiscussionBackfill(db),
      new MinioLegacyDiscussionPayloads(minio),
      new RegisteredDiscussionPayloads(
        new MysqlDiscussionPayloads(db),
        new MinioDiscussionPayloadObjects(minio)
      )
    );
    if (options.apply !== null) {
      console.log(
        JSON.stringify({
          status: 'committed',
          ...(await backfill.apply(
            input,
            options.apply,
            options.legacyWritersStopped
          )),
          projection: 'pending',
        })
      );
    } else {
      const plan = await backfill.plan(input);
      console.log(
        JSON.stringify({
          status: 'planned',
          discussionId: plan.manifest.discussionId,
          tenantId: plan.manifest.tenantId,
          fingerprint: plan.fingerprint,
          manifestFingerprint: plan.manifestFingerprint,
          sourceFingerprint: plan.sourceFingerprint,
          nodes: plan.bodies.length,
          tombstones: plan.bodies.filter((entry) => entry.body === null).length,
          payloadBytes: plan.bodies.reduce(
            (sum, entry) => sum + (entry.body?.length ?? 0),
            0
          ),
        })
      );
    }
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
