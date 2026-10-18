import { isApplicationDraftUrl } from '@domains/catalog/record';
import {
  HEALTH_MAX_MONITORS,
  healthInteger,
  healthObject,
  parseHealthMonitor,
} from '@domains/reliability';

function parseMonitor(input: unknown) {
  const monitor = parseHealthMonitor(input);
  if (monitor.url.length > 2048)
    throw new Error('Normalized monitor URL is too long');
  return monitor;
}

export function healthMonitorInput(
  applicationId: string,
  id: string,
  input: unknown
) {
  const value = healthObject(input, [
    'expectedRevision',
    'expectedApplicationRevision',
    'name',
    'url',
    'enabled',
  ]);
  const expectedRevision = healthInteger(
    value['expectedRevision'],
    0,
    Number.MAX_SAFE_INTEGER - 1
  );
  const monitor = parseMonitor({
    id,
    applicationId,
    revision: expectedRevision + 1,
    name: value['name'],
    url: value['url'],
    enabled: value['enabled'],
  });
  return {
    expectedRevision,
    expectedApplicationRevision: healthInteger(
      value['expectedApplicationRevision'],
      1
    ),
    name: monitor.name,
    url: monitor.url,
    enabled: monitor.enabled,
  };
}

export type HealthMonitorInput = ReturnType<typeof healthMonitorInput>;

export function healthMonitorConfigurations(
  applicationId: string,
  input: unknown
) {
  const value = healthObject(input, [
    'applicationRevision',
    'website',
    'monitors',
  ]);
  const website = value['website'];
  if (
    typeof website !== 'string' ||
    website.length > 2048 ||
    !isApplicationDraftUrl(website) ||
    !Array.isArray(value['monitors']) ||
    value['monitors'].length > HEALTH_MAX_MONITORS
  )
    throw new Error('Invalid health configuration');
  const monitors = value['monitors'].map(parseMonitor);
  if (
    monitors.some((monitor) => monitor.applicationId !== applicationId) ||
    new Set(monitors.map((monitor) => monitor.id)).size !== monitors.length
  )
    throw new Error('Invalid health configuration scope');
  // Older monitor URLs remain visible after the approved website changes.
  return {
    applicationRevision: healthInteger(value['applicationRevision'], 1),
    website,
    monitors,
  };
}

export function healthMonitorReceipt(
  applicationId: string,
  id: string,
  body: HealthMonitorInput,
  input: unknown
) {
  const monitor = parseMonitor(input);
  if (
    monitor.applicationId !== applicationId ||
    monitor.id !== id ||
    monitor.revision !== body.expectedRevision + 1 ||
    monitor.name !== body.name ||
    monitor.url !== body.url ||
    monitor.enabled !== body.enabled
  )
    throw new Error('Mismatched health configuration receipt');
  return monitor;
}
