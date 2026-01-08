import cron from 'node-cron';

export class Scheduler {
  private jobs: cron.ScheduledTask[] = [];

  scheduleDaily(times: string[], callback: () => Promise<void>): void {
    for (const time of times) {
      // time format: "HH:MM" (e.g., "09:00", "17:00")
      const [hour, minute] = time.split(':');
      const cronExpression = `${minute} ${hour} * * *`;

      console.log(`📅 Scheduling daily task at ${time} (cron: ${cronExpression})`);

      const job = cron.schedule(
        cronExpression,
        async () => {
          console.log(`⏰ Scheduled task triggered at ${time}`);
          try {
            await callback();
          } catch (error) {
            console.error(`Error in scheduled task at ${time}:`, error);
          }
        },
        {
          timezone: process.env['TZ'] || 'UTC',
        }
      );

      this.jobs.push(job);
    }
  }

  start(): void {
    this.jobs.forEach((job) => job.start());
    console.log(`✅ Started ${this.jobs.length} scheduled job(s)`);
  }

  stop(): void {
    this.jobs.forEach((job) => job.stop());
    console.log(`🛑 Stopped ${this.jobs.length} scheduled job(s)`);
  }
}
