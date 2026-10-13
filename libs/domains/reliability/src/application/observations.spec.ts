import {
  HEALTH_INTERVAL_MS,
  HEALTH_STALE_AFTER_MS,
  parseHealthMonitor,
  parseHealthObservation,
  summarizeMonitor,
  type HealthMonitor,
  type HealthObservation,
} from './observations';
const id = '10000000-0000-4000-8000-000000000001',
  applicationId = '10000000-0000-4000-8000-000000000002';
const monitor: HealthMonitor = {
  id,
  applicationId,
  revision: 1,
  name: 'Website',
  url: 'https://example.com/health',
  enabled: true,
};
const slotAt = Date.UTC(2026, 9, 13, 12);
const observation: HealthObservation = {
  monitorId: id,
  configurationRevision: 1,
  slotAt,
  observedAt: slotAt + 100,
  status: 'operational',
  reason: 'http-success',
  httpStatus: 200,
  durationMs: 100,
};
describe('Observed application reliability', () => {
  it('preserves a stale last observation even after it leaves the 30-day history window', () => {
    const result = summarizeMonitor(
      monitor,
      [],
      slotAt + 40 * 86_400_000,
      observation
    );
    expect(result.status).toBe('stale');
    expect(result.latest).toEqual(observation);
    expect(result.measured).toBe(0);
    expect(result.availabilityPercent).toBeNull();
  });
  it('shows missing history as unknown without inventing a percentage', () => {
    const result = summarizeMonitor(monitor, [], slotAt);
    expect(result.status).toBe('unknown');
    expect(result.latest).toBeNull();
    expect(result.availabilityPercent).toBeNull();
    expect(result.history).toHaveLength(30);
    expect(
      result.history.every(
        (day) => day.status === 'unknown' && day.measured === 0
      )
    ).toBe(true);
  });
  it('reports sampled availability alongside coverage, with explicit stale boundaries', () => {
    const fresh = summarizeMonitor(
      monitor,
      [observation],
      observation.observedAt
    );
    expect(fresh.status).toBe('operational');
    expect(fresh.measured).toBe(1);
    expect(fresh.expected).toBeGreaterThan(8000);
    expect(fresh.availabilityPercent).toBe(100);
    expect(fresh.history[29].status).toBe('unknown');
    expect(
      summarizeMonitor(
        monitor,
        [observation],
        observation.observedAt + HEALTH_STALE_AFTER_MS - 1
      ).status
    ).toBe('operational');
    expect(
      summarizeMonitor(
        monitor,
        [observation],
        observation.observedAt + HEALTH_STALE_AFTER_MS
      ).status
    ).toBe('stale');
  });
  it('does not count unknown checks or missed slots as success or outage', () => {
    const samples: HealthObservation[] = [
      observation,
      {
        ...observation,
        slotAt: slotAt + HEALTH_INTERVAL_MS,
        observedAt: slotAt + HEALTH_INTERVAL_MS + 100,
        status: 'outage',
        reason: 'http-error',
        httpStatus: 503,
      },
      {
        ...observation,
        slotAt: slotAt + 2 * HEALTH_INTERVAL_MS,
        observedAt: slotAt + 2 * HEALTH_INTERVAL_MS + 100,
        status: 'unknown',
        reason: 'network-error',
        httpStatus: null,
        durationMs: null,
      },
    ];
    const result = summarizeMonitor(
      monitor,
      samples.reverse(),
      slotAt + 3 * HEALTH_INTERVAL_MS
    );
    expect(result.status).toBe('unknown');
    expect(result.measured).toBe(2);
    expect(result.available).toBe(1);
    expect(result.availabilityPercent).toBe(50);
    expect(result.history[29].status).toBe('outage');
  });
  it('rejects duplicates, wrong generations, foreign monitors and future measurements', () => {
    for (const values of [
      [observation, observation],
      [{ ...observation, configurationRevision: 2 }],
      [{ ...observation, monitorId: applicationId }],
    ])
      expect(() => summarizeMonitor(monitor, values, slotAt + 1000)).toThrow();
    expect(() => summarizeMonitor(monitor, [observation], slotAt)).toThrow();
    expect(() =>
      summarizeMonitor({ ...monitor, enabled: false }, [], slotAt)
    ).toThrow();
  });
  it('does not accept fabricated evidence or measurements outside the assigned slot', () => {
    for (const bad of [
      { status: 'operational', reason: 'timeout' },
      { httpStatus: 503 },
      { durationMs: 2000 },
      { observedAt: slotAt - 1 },
      { observedAt: slotAt + HEALTH_INTERVAL_MS },
      { slotAt: slotAt + 1 },
      { configurationRevision: 0 },
      { secret: 'extra' },
    ])
      expect(() =>
        parseHealthObservation({ ...observation, ...bad })
      ).toThrow();
    expect(
      parseHealthObservation({
        ...observation,
        status: 'degraded',
        reason: 'http-slow',
        durationMs: 2000,
      }).status
    ).toBe('degraded');
  });
  it('limits monitors to credential-free standard-port HTTP endpoints; network eligibility is an adapter responsibility', () => {
    for (const url of [
      'file:///etc/passwd',
      'http://localhost/',
      'http://127.0.0.1/',
      'http://[::1]/',
      'https://example.com:8443/',
      'https://user:pass@example.com/',
      'https://example.com/?token=secret',
      'https://example.com/#fragment',
    ])
      expect(() => parseHealthMonitor({ ...monitor, url })).toThrow();
    expect(parseHealthMonitor({ ...monitor, name: ' Website ' }).name).toBe(
      'Website'
    );
    expect(() =>
      parseHealthMonitor({ ...monitor, tenant: 'foreign' })
    ).toThrow();
  });
});
