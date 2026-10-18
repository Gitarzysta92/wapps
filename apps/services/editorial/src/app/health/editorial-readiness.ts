import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EditorialReadinessProbes } from './editorial-readiness.probes';

export interface ReadinessCheck {
  code: string;
  pending?: number;
  failed?: number;
  oldestPendingMs?: number;
  expiredLeases?: number;
  consumers?: number;
  unacknowledged?: number;
  stalledMs?: number;
}

export interface QueueObservation {
  pending: number;
  failed: number;
  consumers: number;
  unacknowledged: number;
  acknowledged: number;
}

// A live consumer alone is insufficient: an unacknowledged delivery can be stuck.
export class MaterializerProgress {
  private previous?: { acknowledged: number; since: number };

  inspect(
    value: QueueObservation,
    now: number,
    maxAge: number
  ): ReadinessCheck {
    const backlog = value.pending + value.unacknowledged;
    if (!backlog) this.previous = undefined;
    else if (
      !this.previous ||
      this.previous.acknowledged !== value.acknowledged
    )
      this.previous = { acknowledged: value.acknowledged, since: now };
    const stalledMs = this.previous
      ? Math.max(0, now - this.previous.since)
      : 0;
    return {
      code:
        value.failed > 0
          ? 'poison_messages'
          : value.consumers === 0
          ? 'worker_missing'
          : backlog > 0 && stalledMs >= maxAge
          ? 'worker_stalled'
          : 'ok',
      pending: value.pending,
      failed: value.failed,
      consumers: value.consumers,
      unacknowledged: value.unacknowledged,
      stalledMs,
    };
  }
}

@Injectable()
export class EditorialReadiness {
  private readonly logger = new Logger(EditorialReadiness.name);
  private readonly progress = new MaterializerProgress();
  private previous = '';
  private running?: ReturnType<EditorialReadiness['probe']>;
  private cached?: {
    at: number;
    value: Awaited<ReturnType<EditorialReadiness['probe']>>;
  };

  constructor(
    private readonly probes: EditorialReadinessProbes,
    private readonly config: ConfigService
  ) {}

  async check() {
    if (this.cached && Date.now() - this.cached.at < 1000)
      return this.cached.value;
    this.running ??= this.probe()
      .then((value) => {
        this.cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  private async probe() {
    const configured = Number(
      this.config.get('EDITORIAL_READINESS_MAX_BACKLOG_MS') ?? 30_000
    );
    const maxAge =
      Number.isSafeInteger(configured) &&
      configured >= 1000 &&
      configured <= 300_000
        ? configured
        : 30_000;
    const [sql, projection, policy, queue] = await Promise.all([
      this.probes.sql(maxAge),
      this.probes.projection(),
      this.probes.policy(),
      this.probes.queue(),
    ]);
    const materializer =
      'code' in queue
        ? queue
        : this.progress.inspect(queue, Date.now(), maxAge);
    const checks = { ...sql, projection, policy, materializer };
    const codes = Object.values(checks).map((check) => check.code);
    const status = codes.every((code) => code === 'ok')
      ? 'ready'
      : codes.every((code) =>
          [
            'ok',
            'dispatch_backlog',
            'worker_missing',
            'worker_stalled',
            'poison_messages',
          ].includes(code)
        )
      ? 'degraded'
      : 'unready';
    const signature = JSON.stringify(
      Object.fromEntries(
        Object.entries(checks).map(([name, check]) => [name, check.code])
      )
    );
    if (signature !== this.previous) {
      // Fixed codes and aggregate counts only; errors, endpoints and resource IDs stay private.
      const event = JSON.stringify({
        event: 'editorial_catalog_readiness',
        status,
        checks,
        runbook: 'docs/EDITORIAL-CATALOG-READINESS.md',
      });
      if (status === 'ready') this.logger.log(event);
      else this.logger.warn(event);
      this.previous = signature;
    }
    return { status, service: 'editorial', scope: 'editorial-catalog', checks };
  }
}
