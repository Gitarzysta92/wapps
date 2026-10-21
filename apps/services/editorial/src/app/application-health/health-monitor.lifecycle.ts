import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObserveApplicationHealth } from './application-health';

@Injectable()
export class HealthMonitorLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(HealthMonitorLifecycle.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  private after: string | null = null;
  constructor(
    private readonly worker: ObserveApplicationHealth,
    private readonly config: ConfigService
  ) {}
  onModuleInit() {
    const enabled = this.config.get<string>('EDITORIAL_HEALTH_MONITOR_ENABLED');
    if (enabled !== undefined && enabled !== 'false' && enabled !== 'true')
      throw new Error('Invalid EDITORIAL_HEALTH_MONITOR_ENABLED');
    if (enabled === 'true') this.kick();
  }
  private kick() {
    if (this.stopped || this.running) return;
    this.running = this.worker
      .batch(this.after)
      .then((result) => {
        this.after = result.after;
        if (result.failed)
          this.log.warn(
            `Health observations failed: ${result.failed}; unfinished slots retain bounded lease retries`
          );
      })
      .catch((error) => {
        this.log.error(
          `Health observation batch failed: ${
            error instanceof Error ? error.name : 'unknown error'
          }`
        );
      })
      .finally(() => {
        this.running = undefined;
        if (!this.stopped)
          this.timer = setTimeout(
            () => this.kick(),
            this.after ? 1000 : 10_000
          );
      });
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }
}
