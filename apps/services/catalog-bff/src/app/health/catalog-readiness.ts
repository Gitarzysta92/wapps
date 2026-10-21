import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const names = [
  'sql',
  'schema',
  'outbox',
  'projection',
  'policy',
  'materializer',
] as const;
const allowed: Record<(typeof names)[number], readonly string[]> = {
  sql: ['ok', 'sql_unavailable'],
  schema: ['ok', 'not_checked', 'schema_incompatible'],
  outbox: ['ok', 'not_checked', 'poison_messages', 'dispatch_backlog'],
  projection: ['ok', 'projection_missing', 'projection_unavailable'],
  policy: ['ok', 'policy_unavailable', 'policy_incompatible'],
  materializer: [
    'ok',
    'queue_unavailable',
    'queue_missing',
    'queue_incompatible',
    'poison_messages',
    'worker_missing',
    'worker_stalled',
  ],
};
const metrics = [
  'pending',
  'failed',
  'oldestPendingMs',
  'expiredLeases',
  'consumers',
  'unacknowledged',
  'stalledMs',
];
type Check = { code: string } & Record<string, number | string>;

// Accept a scoped, bounded owner report; never reflect arbitrary owner errors or fields.
export function parseEditorialReadiness(
  value: unknown,
  httpStatus: number
): Record<string, Check> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;
  if (
    report.service !== 'editorial' ||
    report.scope !== 'editorial-catalog' ||
    !['ready', 'degraded', 'unready'].includes(String(report.status))
  )
    return null;
  if (
    !report.checks ||
    typeof report.checks !== 'object' ||
    Array.isArray(report.checks)
  )
    return null;
  const raw = report.checks as Record<string, unknown>,
    result: Record<string, Check> = {};
  if (Object.keys(raw).length !== names.length) return null;
  for (const name of names) {
    const item = raw[name];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const check = item as Record<string, unknown>;
    if (typeof check.code !== 'string' || !allowed[name].includes(check.code))
      return null;
    result[name] = { code: check.code };
    for (const metric of metrics)
      if (check[metric] !== undefined) {
        const number = check[metric];
        if (
          typeof number !== 'number' ||
          !Number.isSafeInteger(number) ||
          number < 0
        )
          return null;
        result[name][metric] = number;
      }
  }
  const ready = Object.values(result).every((check) => check.code === 'ok');
  if (
    ready !== (report.status === 'ready') ||
    httpStatus !== (ready ? 200 : 503)
  )
    return null;
  return result;
}

@Injectable()
export class CatalogReadiness {
  private running?: ReturnType<CatalogReadiness['probe']>;
  constructor(private readonly config: ConfigService) {}

  check() {
    this.running ??= this.probe().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async probe() {
    let checks: Record<string, Check> = {
      owner: { code: 'owner_unavailable' },
    };
    try {
      const origin = this.config.getOrThrow<string>('EDITORIAL_URL');
      const response = await axios.get(
        `${origin.replace(/\/$/, '')}/api/health/ready`,
        {
          timeout: 2000,
          signal: AbortSignal.timeout(2200),
          maxRedirects: 0,
          maxContentLength: 8192,
          proxy: false,
          validateStatus: (status) => status === 200 || status === 503,
        }
      );
      const parsed = parseEditorialReadiness(response.data, response.status);
      checks = parsed
        ? { owner: { code: 'ok' }, ...parsed }
        : { owner: { code: 'owner_incompatible' } };
    } catch {
      /* A failed owner probe must not become a successful empty journey. */
    }
    const status = Object.values(checks).every((check) => check.code === 'ok')
      ? 'ready'
      : 'unready';
    return {
      status,
      service: 'catalog-bff',
      scope: 'editorial-catalog',
      checks,
    };
  }
}
