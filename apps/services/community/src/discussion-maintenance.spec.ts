import { parseMaintenanceArguments } from './discussion-maintenance';

describe('discussion maintenance arguments', () => {
  it('limits notification requeue to one exact failed receipt', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(parseMaintenanceArguments(['--notification-status'])).toEqual({
      mode: 'notification-status',
    });
    expect(
      parseMaintenanceArguments([
        '--notification-requeue',
        id,
        '--failed-at',
        '100',
      ])
    ).toEqual({ mode: 'notification-requeue', id, failedAt: 100 });
    for (const args of [
      ['--notification-requeue', id],
      ['--notification-requeue', 'all', '--failed-at', '100'],
      ['--notification-requeue', id, '--failed-at', '0'],
      ['--notification-requeue', id, '--failed-at', '0100'],
    ])
      expect(() => parseMaintenanceArguments(args)).toThrow();
  });
  it('previews payload inventory and requires a reviewed acknowledged apply', () => {
    expect(parseMaintenanceArguments(['--inventory-payloads'])).toEqual({
      mode: 'inventory',
      apply: null,
      legacyWritersStopped: false,
    });
    expect(
      parseMaintenanceArguments([
        '--inventory-payloads',
        '--apply',
        'a'.repeat(64),
        '--legacy-writers-stopped',
      ])
    ).toEqual({
      mode: 'inventory',
      apply: 'a'.repeat(64),
      legacyWritersStopped: true,
    });
  });
  it('defaults backfill to a read-only plan', () => {
    expect(
      parseMaintenanceArguments(['--backfill', '--manifest', 'owners.json'])
    ).toEqual({
      mode: 'backfill',
      manifest: 'owners.json',
      apply: null,
      legacyWritersStopped: false,
    });
  });

  it('accepts an explicit fingerprint and maintenance acknowledgement', () => {
    expect(
      parseMaintenanceArguments([
        '--backfill',
        '--manifest',
        'owners.json',
        '--apply',
        'a'.repeat(64),
        '--legacy-writers-stopped',
      ])
    ).toMatchObject({ apply: 'a'.repeat(64), legacyWritersStopped: true });
  });

  it.each([
    ['--backfill'],
    ['--backfill', '--manifest'],
    ['--backfill', '--manifest', 'owners.json', '--apply', 'a'.repeat(64)],
    [
      '--backfill',
      '--manifest',
      'owners.json',
      '--apply',
      'invalid',
      '--legacy-writers-stopped',
    ],
    ['--backfill', '--manifest', 'owners.json', '--legacy-writers-stopped'],
    ['--backfill', '--manifest', 'owners.json', '--manifest', 'another.json'],
    ['--backfill', '--manifest', 'owners.json', '--force'],
    ['--migrate', '--backfill'],
    ['--inventory-payloads', '--manifest', 'owners.json'],
    ['--inventory-payloads', '--legacy-writers-stopped'],
    ['--inventory-payloads', '--apply', 'a'.repeat(64)],
    ['--inventory-payloads', '--apply', 'invalid', '--legacy-writers-stopped'],
    [
      '--inventory-payloads',
      '--apply',
      'a'.repeat(64),
      '--legacy-writers-stopped',
      '--legacy-writers-stopped',
    ],
  ])('rejects unsafe or ambiguous arguments %j', (...args) => {
    expect(() => parseMaintenanceArguments(args)).toThrow();
  });
});
