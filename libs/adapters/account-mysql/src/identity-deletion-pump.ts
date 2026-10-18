export class IdentityDeletionPump {
  private stopped = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active: Promise<void> | undefined;

  constructor(
    private readonly worker: {
      once(): Promise<
        'idle' | 'completed' | 'lease-lost' | 'pending' | 'retry' | 'failed'
      >;
    },
    private readonly onError: (message: string) => void
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
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
      for (let count = 0; count < 100 && !this.stopped; count++) {
        const result = await this.worker.once();
        if (result === 'idle') break;
        if (result === 'failed')
          this.onError(
            'Identity cleanup retained in SQL quarantine; inspect before requeue'
          );
      }
    } catch {
      this.onError('Identity cleanup unavailable; work remains in SQL');
    }
  }
}
