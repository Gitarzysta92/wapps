import {
  overallHealth,
  type ApplicationHealthReport,
  type CurrentHealth,
  type HealthDay,
  type HealthReason,
} from '@domains/reliability';

export const HEALTH_LABELS: Record<CurrentHealth, string> = {
  operational: 'Responding',
  degraded: 'Slow response',
  outage: 'Check failed',
  unknown: 'Unknown',
  stale: 'Stale',
};

const reasons: Record<HealthReason, string> = {
  'http-success': 'The endpoint returned a successful HTTP response.',
  'http-slow': 'The endpoint responded successfully in two seconds or more.',
  'http-error': 'The endpoint returned an unsuccessful HTTP response.',
  timeout: 'The request timed out after ten seconds.',
  'network-error': 'The network or secure connection could not be verified. Availability is unknown.',
  'blocked-target': 'The endpoint did not meet the public-network check requirements. Availability is unknown.',
  redirect: 'The endpoint redirected the request. The destination was not checked.',
  'access-denied': 'The endpoint denied access to the check. Availability is unknown.',
};

export function healthIcon(status: CurrentHealth): string {
  switch (status) {
    case 'operational': return '@tui.check-circle';
    case 'degraded': return '@tui.alert-circle';
    case 'outage': return '@tui.x-circle';
    case 'stale': return '@tui.clock';
    default: return '@tui.circle-help';
  }
}

function dayView(day: HealthDay) {
  return {
    timestamp: day.day,
    status: day.status,
    label: `${new Date(day.day).toISOString().slice(0, 10)} UTC: ${HEALTH_LABELS[day.status]}; ${day.measured} of ${day.expected} intervals measured; ${day.availabilityPercent === null ? 'availability unknown' : day.availabilityPercent + '% sampled availability'}`,
  };
}

/** The adapter validates aligned UTC days; combine status and coverage, never invent app uptime. */
export function applicationHealthView(report: ApplicationHealthReport) {
  const status = overallHealth(report.monitors);
  return {
    status,
    badge: { code: status, message: HEALTH_LABELS[status] },
    message: `${HEALTH_LABELS[status]} across monitored endpoints`,
    asOf: new Date(report.asOf),
    history: (report.monitors[0]?.history ?? []).map((day, index) => {
      const days = report.monitors.map(monitor => monitor.history[index]);
      const status = overallHealth(days);
      const measured = days.reduce((sum, item) => sum + item.measured, 0);
      const expected = days.reduce((sum, item) => sum + item.expected, 0);
      return {
        timestamp: day.day,
        status,
        label: `${new Date(day.day).toISOString().slice(0, 10)} UTC: ${HEALTH_LABELS[status]} across ${days.length} monitored endpoints; ${measured} of ${expected} endpoint intervals measured`,
      };
    }),
    services: report.monitors.map(monitor => ({
      ...monitor,
      label: HEALTH_LABELS[monitor.status],
      icon: healthIcon(monitor.status),
      reason: monitor.latest ? reasons[monitor.latest.reason] : null,
      history: monitor.history.map(dayView),
    })),
  };
}
