import {
  editorialMaintenanceSource,
  EditorialMaintenanceInputError,
  parseEditorialMaintenance,
  readEditorialOwnershipManifest,
} from './maintenance';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editorialId } from './testing/editorial-projection-fixtures';

describe('Editorial maintenance modes', () => {
  it.each([
    [['--migrate'], { mode: 'migrate' }],
    [['--rebuild'], { mode: 'rebuild' }],
    [['--outbox-status'], { mode: 'outbox-status' }],
    [['--media-cleanup'], { mode: 'media-cleanup' }],
    [['--media-cleanup-status'], { mode: 'media-cleanup-status' }],
    [
      ['--media-cleanup-requeue', '019a0010-0000-7000-8000-000000000001'],
      {
        mode: 'media-cleanup-requeue',
        id: '019a0010-0000-7000-8000-000000000001',
      },
    ],
    [['--outbox-requeue', '42'], { mode: 'outbox-requeue', id: '42' }],
  ])('parses an explicit maintenance command %#', (args, expected) => {
    expect(parseEditorialMaintenance(args as string[])).toEqual(expected);
  });

  it.each([
    [],
    ['--unknown'],
    ['--outbox-status', '--apply'],
    ['--media-cleanup', '--all'],
    ['--media-cleanup-status', '--media-cleanup'],
    ['--media-cleanup-requeue'],
    ['--media-cleanup-requeue', 'all'],
    ['--outbox-requeue'],
    ['--outbox-requeue', 'all'],
    ['--outbox-requeue', '-1'],
    ['--outbox-requeue', '1 OR 1'],
    ['--outbox-requeue', '18446744073709551616'],
  ])('refuses ambiguous or unbounded maintenance work %#', (...args) => {
    expect(() => parseEditorialMaintenance(args)).toThrow(
      EditorialMaintenanceInputError
    );
  });

  it('requires explicit database configuration without running implicit migration or seeding', () => {
    expect(() => editorialMaintenanceSource({})).toThrow('Missing');
    const source = editorialMaintenanceSource({
      EDITORIAL_DATABASE_HOST: 'localhost',
      EDITORIAL_DATABASE_PORT: '3306',
      EDITORIAL_DATABASE_USERNAME: 'operator',
      EDITORIAL_DATABASE_PASSWORD: 'test',
      EDITORIAL_DATABASE_NAME: 'editorial',
    });
    expect(source.isInitialized).toBe(false);
    expect(source.options).toMatchObject({
      synchronize: false,
      migrationsRun: false,
      migrationsTableName: 'editorial_migrations',
    });
    expect(source.options.entities).toBeUndefined();
  });
});

describe('Editorial ownership maintenance input', () => {
  const fingerprint = 'a'.repeat(64);
  it('plans read-only and requires a specific reviewed plan before applying', () => {
    expect(
      parseEditorialMaintenance([
        '--backfill',
        '--manifest',
        '/reviewed/owners.json',
      ])
    ).toEqual({
      mode: 'backfill',
      manifest: '/reviewed/owners.json',
      apply: null,
      legacyWritersStopped: false,
    });
    expect(
      parseEditorialMaintenance([
        '--backfill',
        '--apply',
        fingerprint,
        '--manifest',
        '/reviewed/owners.json',
        '--legacy-writers-stopped',
      ])
    ).toEqual({
      mode: 'backfill',
      manifest: '/reviewed/owners.json',
      apply: fingerprint,
      legacyWritersStopped: true,
    });
  });

  it.each([
    ['--backfill'],
    ['--backfill', '--manifest'],
    ['--backfill', '--manifest', 'file', '--apply', fingerprint],
    ['--backfill', '--manifest', 'file', '--legacy-writers-stopped'],
    [
      '--backfill',
      '--manifest',
      'file',
      '--apply',
      'bad',
      '--legacy-writers-stopped',
    ],
    ['--backfill', '--manifest', 'file', '--manifest', 'other'],
    [
      '--backfill',
      '--manifest',
      'file',
      '--apply',
      fingerprint,
      '--legacy-writers-stopped',
      '--legacy-writers-stopped',
    ],
    ['--backfill', '--manifest', 'file', '--unknown'],
  ])('refuses incomplete or ambiguous adoption commands %#', (...args) => {
    expect(() => parseEditorialMaintenance(args)).toThrow();
  });

  it('reads a bounded regular JSON manifest without printing owner assignments', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'editorial-manifest-'));
    const path = join(directory, 'owner.json');
    const manifest = {
      version: 1,
      kind: 'app',
      resourceId: editorialId(),
      tenantId: 'default',
      ownerIdentityId: 'verified',
    };
    try {
      await writeFile(path, JSON.stringify(manifest));
      expect(await readEditorialOwnershipManifest(path)).toEqual(manifest);
      await writeFile(path, 'x'.repeat(16 * 1024 + 1));
      await expect(readEditorialOwnershipManifest(path)).rejects.toThrow(
        '16 KiB'
      );
      await writeFile(path, '{');
      await expect(readEditorialOwnershipManifest(path)).rejects.toThrow(
        'valid JSON'
      );
      await expect(readEditorialOwnershipManifest(directory)).rejects.toThrow(
        'regular file'
      );
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
