import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationImageCleanup } from './application-image-cleanup';

@Injectable()
export class ApplicationImageCleanupLifecycle
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ApplicationImageCleanupLifecycle.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopping = false;
  constructor(
    private readonly cleanup: ApplicationImageCleanup,
    private readonly config: ConfigService
  ) {}
  onModuleInit() {
    const enabled = this.config.get<string>('EDITORIAL_MEDIA_CLEANUP_ENABLED');
    if (enabled !== undefined && enabled !== 'true' && enabled !== 'false')
      throw new Error('EDITORIAL_MEDIA_CLEANUP_ENABLED must be true or false');
    if (enabled === 'true') this.schedule();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }
  private schedule() {
    if (this.stopping) return;
    this.timer = setTimeout(() => {
      this.running = this.tick();
    }, 1000);
    this.timer.unref();
  }
  private async tick() {
    try {
      const report = await this.cleanup.runBatch(1);
      if (report.retired || report.attempted)
        this.logger.log(
          JSON.stringify({ kind: 'application-image-cleanup', ...report })
        );
    } catch {
      this.logger.error(
        'Application image cleanup authority is unavailable; durable work remains pending'
      );
    } finally {
      this.schedule();
    }
  }
}
