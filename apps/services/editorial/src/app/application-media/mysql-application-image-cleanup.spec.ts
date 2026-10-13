import {
  validateApplicationImageCleanup,
  type ApplicationImageCleanupRow,
} from './mysql-application-image-cleanup';

const pending: ApplicationImageCleanupRow = {
  imageId: '019a0010-0000-7000-8000-000000000001',
  reason: 'cancelled',
  createdAt: 100,
  availableAt: 100,
  attempts: 0,
  leaseToken: null,
  leaseUntil: null,
  completedAt: null,
  failedAt: null,
  lastError: null,
};
describe('stored cleanup lifecycle validation', () => {
  it.each([
    pending,
    { ...pending, attempts: 1, leaseToken: 'a'.repeat(64), leaseUntil: 30100 },
    { ...pending, attempts: 1, completedAt: 110 },
    {
      ...pending,
      attempts: 8,
      failedAt: 110,
      lastError: 'lease-attempts-exhausted',
    },
    { ...pending, failedAt: 110, lastError: 'canonical-reference-conflict' },
    {
      ...pending,
      attempts: 1,
      availableAt: 1110,
      lastError: 'storage-or-receipt-unavailable',
    },
  ])('accepts a reachable durable state %#', (row) =>
    expect(() => validateApplicationImageCleanup(row)).not.toThrow()
  );
  it.each([
    { attempts: 9 },
    { reason: 'unknown' },
    { availableAt: 99 },
    { createdAt: NaN },
    { leaseUntil: 100 },
    { attempts: 1, leaseToken: 'a'.repeat(64), leaseUntil: 100 },
    { attempts: 1, leaseToken: 'invalid', leaseUntil: 200 },
    { attempts: 1, completedAt: 99 },
    { attempts: 1, completedAt: 110, availableAt: 120 },
    { attempts: 8, lastError: 'lease-attempts-exhausted' },
    { lastError: 'canonical-reference-conflict' },
    { completedAt: 110 },
    { attempts: 1, failedAt: 110, lastError: 'storage-or-receipt-unavailable' },
    { attempts: 1 },
    {
      attempts: 1,
      completedAt: 110,
      lastError: 'storage-or-receipt-unavailable',
    },
    {
      attempts: 8,
      completedAt: 110,
      failedAt: 110,
      lastError: 'lease-attempts-exhausted',
    },
  ])('rejects impossible lifecycle metadata %#', (patch) =>
    expect(() =>
      validateApplicationImageCleanup({ ...pending, ...patch })
    ).toThrow()
  );
});
