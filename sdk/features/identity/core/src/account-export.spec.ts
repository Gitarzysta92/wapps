const ACCOUNT_EXPORT_SOURCES = ['alpha', 'beta', 'Gamma/v42'] as const;
import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportCaptureSequence,
  AccountExportSourceInvalid,
  AccountExportLimitExceeded,
  parseAccountExportArtifact,
  parseAccountExportJob,
} from './account-export';

const id = '00000000-0000-4000-8000-000000000001';
const job = {
  id,
  status: 'queued',
  requestedAt: 100,
  expiresAt: 100 + ACCOUNT_EXPORT_LIMITS.retentionMs,
  attempts: 0,
  bytes: null,
  sha256: null,
  readyAt: null,
  failure: null,
};
const artifact = {
  bytes: 300_000,
  sha256: 'a'.repeat(64),
  chunks: 2,
  captures: ACCOUNT_EXPORT_SOURCES.map((source) => ({
    source,
    startedAt: 100,
    completedAt: 200,
    records: 0,
  })),
};

describe('account export completeness', () => {
  it('bounds aggregate text before JSON serialization can allocate an oversized record', () => {
    const sequence = new AccountExportCaptureSequence('account');
    sequence.accept({ type: 'begin', source: 'account', at: 100 });
    const repeated = 'x'.repeat(100_000);
    expect(() =>
      sequence.accept({
        type: 'record',
        source: 'account',
        collection: 'profile',
        data: Array(11).fill(repeated),
      })
    ).toThrow(AccountExportLimitExceeded);
  });
  it('accepts a complete ordered set of canonical captures', () => {
    expect(
      parseAccountExportArtifact(artifact, ACCOUNT_EXPORT_SOURCES)
    ).toEqual(artifact);
    expect(parseAccountExportJob(job)).toEqual(job);
    expect(
      parseAccountExportJob({
        ...job,
        status: 'ready',
        attempts: 1,
        readyAt: 200,
        bytes: artifact.bytes,
        sha256: artifact.sha256,
      })
    ).toMatchObject({ status: 'ready' });
  });
  it.each([
    { captures: artifact.captures.slice(1) },
    { captures: [...artifact.captures].reverse() },
    {
      captures: artifact.captures.map((capture) => ({
        ...capture,
        source: 'account',
      })),
    },
    {
      captures: artifact.captures.map((capture) => ({
        ...capture,
        completedAt: 99,
      })),
    },
    {
      captures: artifact.captures.map((capture) => ({
        ...capture,
        records: 1_000_001,
      })),
    },
    {
      captures: artifact.captures.map((capture) => ({
        ...capture,
        extra: true,
      })),
    },
    { bytes: 0 },
    { chunks: 1 },
    { bytes: ACCOUNT_EXPORT_LIMITS.archiveBytes + 1 },
    { sha256: 'invalid' },
    { bytes: '300000' },
    { extra: true },
  ])('refuses invalid artifacts without a retryable error: %j', (invalid) => {
    expect(() =>
      parseAccountExportArtifact(
        { ...artifact, ...invalid },
        ACCOUNT_EXPORT_SOURCES
      )
    ).toThrow(AccountExportSourceInvalid);
  });
  it.each([
    { status: 'ready', attempts: 1 },
    { status: 'building' },
    { status: 'failed' },
    { failure: 'source-unavailable' },
    { attempts: 7 },
    { requestedAt: 0 },
    { expiresAt: job.expiresAt + 1 },
    { bytes: 100 },
    { sha256: 'a'.repeat(64) },
    { readyAt: 150 },
    { status: { toString: (): string => 'queued' } },
    { extra: true },
  ])('refuses inconsistent or noncanonical job states: %j', (invalid) => {
    expect(() => parseAccountExportJob({ ...job, ...invalid })).toThrow();
  });
  it('counts only records and requires explicit complete source closure', () => {
    const sequence = new AccountExportCaptureSequence('account');
    sequence.accept({ type: 'begin', source: 'account', at: 100 });
    sequence.accept({
      type: 'record',
      source: 'account',
      collection: 'profile',
      data: { name: 'Member', fields: [null, true, 2] },
    });
    expect(() => sequence.finish()).toThrow('without completion');
    sequence.accept({ type: 'end', source: 'account', at: 101, records: 1 });
    expect(sequence.finish()).toEqual({
      source: 'account',
      startedAt: 100,
      completedAt: 101,
      records: 1,
    });
    expect(() =>
      sequence.accept({
        type: 'record',
        source: 'account',
        collection: 'profile',
        data: {},
      })
    ).toThrow();
  });
  it.each([
    { type: 'begin', source: 'credentials', at: 100 },
    { type: 'record', source: 'account', collection: 'profile', data: {} },
    { type: 'end', source: 'account', at: 100, records: 0 },
  ])('refuses an absent or mismatched source start: %j', (input) => {
    expect(() =>
      new AccountExportCaptureSequence('account').accept(input)
    ).toThrow(AccountExportSourceInvalid);
  });
  it.each([
    { type: 'begin', source: 'account', at: 100 },
    { type: 'end', source: 'account', at: 99, records: 0 },
    { type: 'end', source: 'account', at: 101, records: 1 },
    { type: 'end', source: 'account', at: 101, records: 0, secret: 'no' },
    { type: 'record', source: 'discussion', collection: 'profile', data: {} },
    { type: 'record', source: 'account', collection: '../secret', data: {} },
  ])(
    'rejects replayed boundaries, scopes and completion disagreement: %j',
    (input) => {
      const sequence = new AccountExportCaptureSequence('account');
      sequence.accept({ type: 'begin', source: 'account', at: 100 });
      expect(() => sequence.accept(input)).toThrow(AccountExportSourceInvalid);
    }
  );
  it.each([
    undefined,
    NaN,
    Infinity,
    BigInt(1),
    new Date(),
    [undefined],
    { omitted: undefined },
    new Array(1),
  ])('rejects values JSON would silently change: %p', (data) => {
    const sequence = new AccountExportCaptureSequence('account');
    sequence.accept({ type: 'begin', source: 'account', at: 100 });
    expect(() =>
      sequence.accept({
        type: 'record',
        source: 'account',
        collection: 'profile',
        data,
      })
    ).toThrow(AccountExportSourceInvalid);
  });
  it('bounds cyclic and deeply nested records', () => {
    const data: Record<string, unknown> = {};
    data.self = data;
    const sequence = new AccountExportCaptureSequence('account');
    sequence.accept({ type: 'begin', source: 'account', at: 100 });
    expect(() =>
      sequence.accept({
        type: 'record',
        source: 'account',
        collection: 'profile',
        data,
      })
    ).toThrow('too complex');
  });
});
