import { ContentClassification1791886000000 } from './app/content-classification/content-classification.migration';
import { HealthObservations1791840018000 } from './app/application-health/health-observations.migration';
import { EditorialContentUpdates1791840017000 } from './app/infrastructure/content-update-cursors.migration';
import {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} from '@wapps/account-mysql';
import { MysqlArticleCoverCleanup } from './app/article-covers/mysql-article-cover-cleanup';
import { ConfiguredArticleCoverObjects } from './app/article-covers/article-cover-storage';
import { ArticleCoverCleanup1791676821000 } from './app/article-covers/article-cover-cleanup.migration';
import { ArticleCoverReferences1791676820000 } from './app/article-covers/article-cover-references.migration';
import { ArticleCovers1791676819000 } from './app/article-covers/article-covers.migration';
import { ArticleWorkspace1791676818000 } from './app/articles/article-workspace.migration';
import { ReleaseWorkspace1791676817000 } from './app/releases/release-workspace.migration';
import { ApplicationPublication1791676811000 } from './app/application-publication/application-publication.migration';
import { ApplicationOwnership1791676812000 } from './app/application-ownership/application-ownership.migration';
import { ApplicationEditing1791676813000 } from './app/application-drafts/application-editing.migration';
import { ApplicationImages1791676814000 } from './app/application-media/application-images.migration';
import { ApplicationImageBindings1791676815000 } from './app/application-media/application-image-bindings.migration';
import { ApplicationImageCleanup1791676816000 } from './app/application-media/application-image-cleanup.migration';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { applicationImageId } from '@domains/catalog/media';
import { ApplicationImageCleanup } from './app/application-media/application-image-cleanup';
import { MysqlApplicationImageCleanup } from './app/application-media/mysql-application-image-cleanup';
import { ConfiguredApplicationImageObjects } from './app/application-media/configured-application-image-objects';
import { SuiteWorkspace1791676808000 } from './app/suites/suite-workspace.migration';
import { SuitePublication1791676809000 } from './app/suites/suite-publication.migration';
import { SuitePublicationSnapshots1791840009000 } from './app/suites/suite-publication-snapshots.migration';
import { EditorialAuthorErasure1791840010000 } from './app/account-erasure/editorial-author-erasure.migration';
import { EditorialMediaAssets1791840011000 } from './app/application-media/editorial-media-assets.migration';
import { EditorialWorkspaceErasure1791840012000 } from './app/account-erasure/editorial-workspace-erasure.migration';
import { EditorialAuditErasure1791840013000 } from './app/account-erasure/editorial-audit-erasure.migration';
import { EditorialErasureCompletion1791840014000 } from './app/account-erasure/editorial-erasure-completion.migration';
import { ApplicationDrafts1791676810000 } from './app/application-drafts/application-drafts.migration';
import { open } from 'node:fs/promises';
import { MysqlEditorialOutbox } from './app/infrastructure/mysql-editorial-outbox';
import { EditorialOwnership1791676802000 } from './app/infrastructure/editorial-schema.migration';
import { MysqlEditorialProjectionRecovery } from './app/infrastructure/mysql-editorial-projection-recovery';
import { rebuildEditorialProjections } from './app/application/editorial-projection-recovery';
import {
  EditorialLegacyBackfill,
  parseEditorialOwnershipManifest,
} from './app/application/editorial-backfill';
import { MysqlEditorialBackfill } from './app/infrastructure/mysql-editorial-backfill';
import { EditorialBackfill1791676803000 } from './app/infrastructure/editorial-backfill.migration';

type MaintenanceCommand =
  | { mode: 'migrate' }
  | { mode: 'outbox-status' }
  | { mode: 'article-cover-cleanup' }
  | { mode: 'article-cover-cleanup-status' }
  | { mode: 'article-cover-cleanup-requeue'; id: string }
  | { mode: 'media-cleanup' }
  | { mode: 'media-cleanup-status' }
  | { mode: 'media-cleanup-requeue'; id: string }
  | { mode: 'rebuild' }
  | {
      mode: 'backfill';
      manifest: string;
      apply: string | null;
      legacyWritersStopped: boolean;
    }
  | { mode: 'outbox-requeue'; id: string };

export class EditorialMaintenanceInputError extends Error {}

export function parseEditorialMaintenance(args: string[]): MaintenanceCommand {
  if (args.length === 1 && args[0] === '--article-cover-cleanup')
    return { mode: 'article-cover-cleanup' };
  if (args.length === 1 && args[0] === '--article-cover-cleanup-status')
    return { mode: 'article-cover-cleanup-status' };
  if (args.length === 2 && args[0] === '--article-cover-cleanup-requeue') {
    try {
      return {
        mode: 'article-cover-cleanup-requeue',
        id: applicationImageId(args[1]),
      };
    } catch {
      throw new EditorialMaintenanceInputError(
        'Invalid article cover cleanup identity'
      );
    }
  }
  if (args.length === 1 && args[0] === '--media-cleanup')
    return { mode: 'media-cleanup' };
  if (args.length === 1 && args[0] === '--media-cleanup-status')
    return { mode: 'media-cleanup-status' };
  if (args.length === 2 && args[0] === '--media-cleanup-requeue') {
    try {
      return { mode: 'media-cleanup-requeue', id: applicationImageId(args[1]) };
    } catch {
      throw new EditorialMaintenanceInputError(
        'Invalid image cleanup identity'
      );
    }
  }
  if (args[0] === '--backfill') return parseBackfillArguments(args);
  if (args.length === 1 && args[0] === '--rebuild') return { mode: 'rebuild' };
  if (args.length === 1 && args[0] === '--migrate') return { mode: 'migrate' };
  if (args.length === 1 && args[0] === '--outbox-status')
    return { mode: 'outbox-status' };
  if (
    args.length === 2 &&
    args[0] === '--outbox-requeue' &&
    /^[1-9][0-9]{0,19}$/.test(args[1]) &&
    BigInt(args[1]) <= 18446744073709551615n
  )
    return { mode: 'outbox-requeue', id: args[1] };
  throw new EditorialMaintenanceInputError(
    'Expected --migrate, --rebuild, --outbox-status, --outbox-requeue <failed-outbox-id>, --media-cleanup, --media-cleanup-status, --media-cleanup-requeue <image-id>, --article-cover-cleanup, --article-cover-cleanup-status, --article-cover-cleanup-requeue <cover-id>, or --backfill --manifest <file> [--apply <reviewed-fingerprint> --legacy-writers-stopped]'
  );
}

function parseBackfillArguments(args: string[]): MaintenanceCommand {
  let manifest: string | null = null;
  let apply: string | null = null;
  let legacyWritersStopped = false;
  for (let index = 1; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--legacy-writers-stopped' && !legacyWritersStopped)
      legacyWritersStopped = true;
    else if (
      (arg === '--manifest' && manifest === null) ||
      (arg === '--apply' && apply === null)
    ) {
      const value = args[++index];
      if (!value || value.startsWith('--'))
        throw new EditorialMaintenanceInputError(`Missing value for ${arg}`);
      if (arg === '--manifest') manifest = value;
      else apply = value;
    } else
      throw new EditorialMaintenanceInputError(
        'Unknown or duplicate backfill argument'
      );
  }
  if (
    !manifest ||
    (apply !== null &&
      (!/^[a-f0-9]{64}$/.test(apply) || !legacyWritersStopped)) ||
    (apply === null && legacyWritersStopped)
  )
    throw new EditorialMaintenanceInputError(
      'Expected a manifest; apply requires its reviewed fingerprint and --legacy-writers-stopped'
    );
  return { mode: 'backfill', manifest, apply, legacyWritersStopped };
}

export async function readEditorialOwnershipManifest(path: string) {
  const file = await open(path, 'r');
  try {
    if (!(await file.stat()).isFile())
      throw new EditorialMaintenanceInputError(
        'Ownership manifest must be a regular file'
      );
    const buffer = Buffer.alloc(16 * 1024 + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        length,
        buffer.length - length,
        null
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > 16 * 1024)
      throw new EditorialMaintenanceInputError(
        'Ownership manifest exceeds 16 KiB'
      );
    let input: unknown;
    try {
      input = JSON.parse(buffer.subarray(0, length).toString('utf8'));
    } catch {
      throw new EditorialMaintenanceInputError(
        'Ownership manifest is not valid JSON'
      );
    }
    return parseEditorialOwnershipManifest(input);
  } finally {
    await file.close();
  }
}

export function editorialMaintenanceSource(
  environment: Record<string, string | undefined>
): DataSource {
  const required = (key: string) => {
    const value = environment[`EDITORIAL_DATABASE_${key}`];
    if (!value)
      throw new EditorialMaintenanceInputError(
        `Missing EDITORIAL_DATABASE_${key}`
      );
    return value;
  };
  const port = Number(required('PORT'));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new EditorialMaintenanceInputError('Invalid EDITORIAL_DATABASE_PORT');
  return new DataSource({
    type: 'mysql',
    timezone: 'Z',
    host: required('HOST'),
    port,
    username: required('USERNAME'),
    password: required('PASSWORD'),
    database: required('NAME'),
    connectTimeout: 10_000,
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: 'none',
    migrations: [
      EditorialOwnership1791676802000,
      EditorialBackfill1791676803000,
      SuiteWorkspace1791676808000,
      SuitePublication1791676809000,
      ApplicationDrafts1791676810000,
      ApplicationPublication1791676811000,
      ApplicationOwnership1791676812000,
      ApplicationEditing1791676813000,
      ApplicationImages1791676814000,
      ApplicationImageBindings1791676815000,
      ApplicationImageCleanup1791676816000,
      ReleaseWorkspace1791676817000,
      ArticleWorkspace1791676818000,
      ArticleCovers1791676819000,
      ArticleCoverReferences1791676820000,
      ArticleCoverCleanup1791676821000,
      IdentityWriteBarrier1791840000000,
      AccountErasureRequests1791840001000,
      SuitePublicationSnapshots1791840009000,
      EditorialAuthorErasure1791840010000,
      EditorialMediaAssets1791840011000,
      EditorialWorkspaceErasure1791840012000,
      EditorialAuditErasure1791840013000,
      EditorialErasureCompletion1791840014000,
      EditorialContentUpdates1791840017000,
      HealthObservations1791840018000,
      ContentClassification1791886000000,
    ],
    migrationsTableName: 'editorial_migrations',
  });
}

export async function runEditorialMaintenance(args: string[]): Promise<void> {
  const command = parseEditorialMaintenance(args);
  const manifest =
    command.mode === 'backfill'
      ? await readEditorialOwnershipManifest(command.manifest)
      : null;
  const source = editorialMaintenanceSource(process.env);
  await source.initialize();
  try {
    if (
      command.mode === 'article-cover-cleanup' ||
      command.mode === 'article-cover-cleanup-status' ||
      command.mode === 'article-cover-cleanup-requeue' ||
      command.mode === 'media-cleanup' ||
      command.mode === 'media-cleanup-status' ||
      command.mode === 'media-cleanup-requeue'
    ) {
      if (await source.showMigrations())
        throw new EditorialMaintenanceInputError(
          'Run --migrate before image cleanup maintenance'
        );
      const covers = command.mode.startsWith('article-cover-');
      const cleanup = covers
        ? new MysqlArticleCoverCleanup(source)
        : new MysqlApplicationImageCleanup(source);
      if (
        command.mode === 'media-cleanup-status' ||
        command.mode === 'article-cover-cleanup-status'
      ) {
        console.log(
          JSON.stringify({ mode: command.mode, ...(await cleanup.status()) })
        );
      } else if (
        command.mode === 'media-cleanup-requeue' ||
        command.mode === 'article-cover-cleanup-requeue'
      ) {
        const requeued = await cleanup.requeue(command.id, Date.now());
        console.log(
          JSON.stringify({ mode: command.mode, id: command.id, requeued })
        );
        if (!requeued) process.exitCode = 2;
      } else {
        const objects = covers
          ? new ConfiguredArticleCoverObjects(new ConfigService(process.env))
          : new ConfiguredApplicationImageObjects(
              new ConfigService(process.env)
            );
        try {
          const report = await new ApplicationImageCleanup(
            cleanup,
            objects
          ).runBatch();
          const status = await cleanup.status();
          console.log(
            JSON.stringify({
              mode: command.mode,
              ...report,
              ...status,
            })
          );
          if (
            report.failed ||
            report.scheduled ||
            report.unconfirmed ||
            status.failures.length
          )
            process.exitCode = 2;
        } finally {
          objects.onModuleDestroy();
        }
      }
      return;
    }
    if (command.mode === 'backfill') {
      const backfill = new EditorialLegacyBackfill(
        new MysqlEditorialBackfill(
          source,
          process.env.EDITORIAL_PUBLIC_TENANT ?? 'default'
        )
      );
      if (command.apply !== null) {
        const receipt = await backfill.apply(
          manifest,
          command.apply,
          command.legacyWritersStopped
        );
        console.log(
          JSON.stringify({
            mode: 'backfill',
            status: 'committed',
            ...receipt,
            projection: 'pending',
          })
        );
      } else {
        const plan = await backfill.plan(manifest);
        console.log(
          JSON.stringify({
            mode: 'backfill',
            status: 'planned',
            kind: plan.manifest.kind,
            resourceId: plan.manifest.resourceId,
            fingerprint: plan.fingerprint,
            sourceFingerprint: plan.sourceFingerprint,
            manifestFingerprint: plan.manifestFingerprint,
          })
        );
      }
      return;
    }
    if (command.mode === 'rebuild') {
      const report = await rebuildEditorialProjections(
        new MysqlEditorialProjectionRecovery(source),
        (result) => console.log(JSON.stringify(result))
      );
      console.log(JSON.stringify({ mode: 'rebuild', ...report }));
      if (report.failed || report.conflicts) process.exitCode = 1;
      else if (report.changed) process.exitCode = 2;
      return;
    }
    if (command.mode === 'migrate') {
      const migrations = await source.runMigrations({ transaction: 'none' });
      console.log(
        JSON.stringify({
          mode: 'migrate',
          applied: migrations.map((migration) => migration.name),
        })
      );
      return;
    }
    const outbox = new MysqlEditorialOutbox(source);
    if (command.mode === 'outbox-status') {
      console.log(
        JSON.stringify({ mode: 'outbox-status', ...(await outbox.status()) })
      );
      return;
    }
    const requeued = await outbox.requeueFailed(command.id, Date.now());
    console.log(
      JSON.stringify({ mode: 'outbox-requeue', id: command.id, requeued })
    );
    if (!requeued) process.exitCode = 2;
  } finally {
    await source.destroy();
  }
}
