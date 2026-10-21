import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliverFavoriteUpdates } from '@wapps/account';

@Injectable()
export class FavoriteUpdateWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('FavoriteUpdateWorker');
  private timer?: ReturnType<typeof setTimeout>;
  private active?: Promise<void>;
  private stopped = true;
  constructor(
    private readonly delivery: DeliverFavoriteUpdates,
    private readonly config: ConfigService
  ) {}

  onModuleInit(): void {
    if (
      this.config.get<string>('FAVORITE_UPDATE_WORKER_ENABLED') !== 'true' ||
      !this.stopped
    )
      return;
    this.stopped = false;
    this.schedule(0);
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.active;
  }
  private schedule(delay: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.active = this.drain().finally(() => {
        this.active = undefined;
        this.schedule(1000);
      });
    }, delay);
    this.timer.unref();
  }
  private async drain(): Promise<void> {
    try {
      for (let count = 0; count < 10 && !this.stopped; count++) {
        if (!(await this.delivery.advance())) break;
      }
    } catch {
      this.logger.error(
        'Favorite update delivery unavailable; subscription retry remains durable'
      );
    }
  }
}
