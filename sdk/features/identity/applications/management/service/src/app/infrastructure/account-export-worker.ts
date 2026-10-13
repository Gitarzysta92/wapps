import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { CompleteAccountExport } from '@sdk/features/identity/libs/management';

/** One capture per process. SQL leases arbitrate other replicas and recover interrupted attempts. */
@Injectable()
export class AccountExportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AccountExportWorker');
  private timer?: ReturnType<typeof setTimeout>;
  private active?: Promise<void>;
  private controller?: AbortController;
  constructor(private readonly worker: CompleteAccountExport) {}

  onModuleInit(): void {
    if (this.controller) return;
    this.controller = new AbortController();
    this.schedule(0);
  }
  async onModuleDestroy(): Promise<void> {
    clearTimeout(this.timer);
    this.controller?.abort();
    await this.active;
  }
  private schedule(delay: number): void {
    const signal = this.controller?.signal;
    if (!signal || signal.aborted) return;
    this.timer = setTimeout(() => {
      this.active = this.drain(signal).finally(() => {
        this.active = undefined;
        this.schedule(1000);
      });
    }, delay);
    this.timer.unref();
  }
  private async drain(signal: AbortSignal): Promise<void> {
    try {
      for (let count = 0; count < 4 && !signal.aborted; count++) {
        const outcome = await this.worker.once(signal);
        if (outcome === 'idle') break;
        if (outcome === 'failed')
          this.logger.warn(
            'Account export failed; canonical job status records the failure category'
          );
      }
    } catch {
      if (!signal.aborted)
        this.logger.error(
          'Account export worker unavailable; durable jobs remain in SQL'
        );
    }
  }
}
