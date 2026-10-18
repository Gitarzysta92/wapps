import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliverReplyNotifications } from '@wapps/account';

@Injectable()
export class ReplyNotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ReplyNotificationWorker');
  private timer?: ReturnType<typeof setTimeout>;
  private active?: Promise<void>;
  private stopped = true;
  constructor(
    private readonly delivery: DeliverReplyNotifications,
    private readonly config: ConfigService
  ) {}

  onModuleInit(): void {
    if (
      this.config.get<string>('REPLY_NOTIFICATION_WORKER_ENABLED') !== 'true' ||
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
        'Reply delivery unavailable; durable work remains in the Discussion journal'
      );
    }
  }
}
