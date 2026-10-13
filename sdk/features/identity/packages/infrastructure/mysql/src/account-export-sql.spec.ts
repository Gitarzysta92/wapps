import {
  ACCOUNT_EXPORT_LIMITS,
  ACCOUNT_EXPORT_SOURCES,
  AccountExportSourceInvalid,
} from '@sdk/features/identity/core';
import { accountExportFromSql, accountExportView } from './account-export-sql';

const row = {
  id: '00000000-0000-4000-8000-000000000001',
  identityId: 'Member',
  commandKey: 'key',
  status: 'queued',
  requestedAt: '100',
  expiresAt: String(100 + ACCOUNT_EXPORT_LIMITS.retentionMs),
  availableAt: '100',
  attempts: '0',
  readyAt: null,
  artifact: null,
  failure: null,
  leaseToken: null,
  leasedUntil: null,
};
const token = '00000000-0000-4000-8000-000000000002';
const artifact = {
  bytes: 10,
  chunks: 1,
  sha256: 'a'.repeat(64),
  captures: ACCOUNT_EXPORT_SOURCES.map((source) => ({
    source,
    startedAt: 100,
    completedAt: 101,
    records: 0,
  })),
};
describe('canonical account export storage decoding', () => {
  it('normalizes MySQL numeric strings without accepting noncanonical coercions', () => {
    expect(accountExportFromSql(row)).toMatchObject({
      attempts: 0,
      requestedAt: 100,
      identityId: 'Member',
    });
    for (const value of [' 1', '1.0', '-1', NaN, true])
      expect(() => accountExportFromSql({ ...row, attempts: value })).toThrow(
        AccountExportSourceInvalid
      );
  });
  it.each([
    { status: 'building', attempts: '1' },
    { leaseToken: token },
    { leasedUntil: '101' },
    {
      status: 'building',
      attempts: '1',
      leaseToken: token,
      leasedUntil: row.expiresAt + '0',
    },
    {
      status: 'ready',
      attempts: '1',
      readyAt: '101',
      artifact: JSON.stringify(artifact),
    },
    { availableAt: '99' },
    { commandKey: 'with spaces' },
    { artifact: '{' },
    { artifact: { ...artifact, captures: [] } },
    { identityId: '' },
    { status: 'arbitrary' },
  ])('rejects an invalid stored state: %j', (invalid) => {
    expect(() => accountExportFromSql({ ...row, ...invalid })).toThrow(
      AccountExportSourceInvalid
    );
  });
  it('uses physical state validation before applying expiry to a public view', () => {
    const ready = accountExportFromSql({
      ...row,
      status: 'ready',
      attempts: '1',
      readyAt: '101',
      artifact: JSON.stringify(artifact),
      leaseToken: token,
    });
    expect(accountExportView(ready, 102)).toMatchObject({
      status: 'ready',
      bytes: 10,
      sha256: artifact.sha256,
    });
    expect(accountExportView(ready, ready.expiresAt)).toMatchObject({
      status: 'expired',
      readyAt: null,
      bytes: null,
      sha256: null,
      failure: null,
    });
    expect(Object.keys(accountExportView(ready, 102))).not.toContain(
      'leaseToken'
    );
  });
});
