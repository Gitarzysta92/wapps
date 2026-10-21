import type { ApplicationHealthReport, HealthDay, MonitorHealth } from '@domains/reliability';
import { applicationHealthView } from './health-view';

const asOf = Date.UTC(2026, 9, 19, 12);
const days = (status: HealthDay['status'], measured: number, available: number): HealthDay[] =>
  Array.from({ length: 30 }, (_, index) => ({
    day: Date.UTC(2026, 8, 20 + index), status, expected: 288,
    measured, available, availabilityPercent: measured ? available / measured * 100 : null,
  }));
function monitor(status: MonitorHealth['status'], history: HealthDay[]): MonitorHealth {
  return {
    id: status, name: 'Configured endpoint', url: 'https://example.test/health', revision: 1,
    status, latest: null, history, expected: 8640,
    measured: history.reduce((sum, day) => sum + day.measured, 0),
    available: history.reduce((sum, day) => sum + day.available, 0),
    availabilityPercent: history[0].availabilityPercent,
  };
}
const report = (monitors: MonitorHealth[]): ApplicationHealthReport => ({
  application: { id: 'application', slug: 'application', name: 'Application' }, asOf, monitors,
});

describe('accepted health view mapping', () => {
  it('keeps unknown and measured zero distinct and only supplies configured services', () => {
    const view = applicationHealthView(report([
      monitor('unknown', days('unknown', 0, 0)),
      monitor('outage', days('outage', 1, 0)),
    ]));
    expect(view.services.map(service => service.availabilityPercent)).toEqual([null, 0]);
    expect(view.services[0].history[0].label).toContain('availability unknown');
    expect(view.services[1].history[0].label).toContain('0% sampled availability');
    expect(view.services[0].reason).toBeNull();
    expect(view.asOf.getTime()).toBe(asOf);
    expect(view.history[0].label).toBe('2026-09-20 UTC: Check failed across 2 monitored endpoints; 1 of 576 endpoint intervals measured');
    expect(view.history[29].timestamp).toBe(Date.UTC(2026, 9, 19));
  });

  it('does not label partial successful history operational or combine ratios into app uptime', () => {
    const view = applicationHealthView(report([
      monitor('operational', days('operational', 288, 288)),
      monitor('unknown', days('unknown', 1, 1)),
    ]));
    expect(view.history.every(day => day.status === 'unknown')).toBe(true);
    expect(view.services[1].availabilityPercent).toBe(100);
    expect(view.history[0].label).toContain('289 of 576');
    expect(view).not.toHaveProperty('availabilityPercent');
  });

  it('preserves current stale status independently of daily degradation and measured availability', () => {
    const stale = monitor('stale', days('degraded', 1, 1));
    stale.latest = {
      monitorId: stale.id, configurationRevision: 1, slotAt: asOf - 1800000,
      observedAt: asOf - 1800000, status: 'degraded', reason: 'http-slow',
      httpStatus: 200, durationMs: 2400,
    };
    const view = applicationHealthView(report([stale]));
    expect(view.badge).toEqual({ code: 'stale', message: 'Stale' });
    expect(view.services[0].icon).toBe('@tui.clock');
    expect(view.services[0].reason).toContain('two seconds');
    expect(view.services[0].availabilityPercent).toBe(100);
    expect(view.history[0].status).toBe('degraded');
  });

  it('does not generate history, service cards or notices for an unmonitored application', () => {
    const view = applicationHealthView(report([]));
    expect(view.status).toBe('unknown');
    expect(view.history).toEqual([]);
    expect(view.services).toEqual([]);
    expect(view).not.toHaveProperty('notices');
  });
});
