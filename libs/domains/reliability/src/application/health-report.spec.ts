import { parseApplicationHealthReport, overallHealth } from './health-report';
import {
  summarizeMonitor,
  type HealthMonitor,
  type HealthObservation,
} from './observations';

const id = '10000000-0000-4000-8000-000000000001',
  applicationId = '10000000-0000-4000-8000-000000000002';
const now = Date.UTC(2026, 9, 13, 12);
const monitor: HealthMonitor = {
  id,
  applicationId,
  revision: 1,
  name: 'Website',
  url: 'https://example.com/',
  enabled: true,
};
const sample: HealthObservation = {
  monitorId: id,
  configurationRevision: 1,
  slotAt: now,
  observedAt: now,
  status: 'operational',
  reason: 'http-success',
  httpStatus: 200,
  durationMs: 10,
};
const report = () => ({
  application: { id: applicationId, slug: 'example', name: 'Example' },
  asOf: now,
  monitors: [summarizeMonitor(monitor, [sample], now)],
});

describe('Public health report', () => {
  it('round-trips bounded daily evidence including partial coverage', () => {
    expect(parseApplicationHealthReport(report())).toEqual(report());
    expect(
      parseApplicationHealthReport({ ...report(), monitors: [] }).monitors
    ).toEqual([]);
  });
  it('rejects success without evidence, stale status tampering and impossible totals', () => {
    for (const change of [
      { latest: null },
      { status: 'stale' },
      { measured: 99999 },
      { available: 0 },
      { availabilityPercent: 99 },
      { revision: 2 },
      { history: [] },
      { latest: { ...sample, observedAt: now + 1 } },
    ])
      expect(() =>
        parseApplicationHealthReport({
          ...report(),
          monitors: [{ ...report().monitors[0], ...change }],
        })
      ).toThrow();
  });
  it('rejects fabricated complete uptime and duplicate monitors', () => {
    const input = report();
    input.monitors[0].history[29].status = 'operational';
    expect(() => parseApplicationHealthReport(input)).toThrow();
    expect(() =>
      parseApplicationHealthReport({
        ...report(),
        monitors: [report().monitors[0], report().monitors[0]],
      })
    ).toThrow();
  });
  it('requires daily history to agree with the latest failed or slow response', () => {
    const input = report();
    input.monitors[0].latest = {
      ...sample,
      status: 'outage',
      reason: 'http-error',
      httpStatus: 503,
    };
    input.monitors[0].status = 'outage';
    expect(() => parseApplicationHealthReport(input)).toThrow();
  });
  it('summarizes only observed monitors and never calls an empty selection operational', () => {
    expect(overallHealth([])).toBe('unknown');
    for (const status of ['unknown', 'stale', 'degraded', 'outage'] as const)
      expect(overallHealth([{ status: 'operational' }, { status }])).toBe(
        status
      );
    expect(overallHealth([{ status: 'outage' }, { status: 'unknown' }])).toBe(
      'outage'
    );
  });
});
