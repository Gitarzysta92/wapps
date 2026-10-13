import { ConfigService } from '@nestjs/config';
import { HealthMonitorLifecycle } from './health-monitor.lifecycle';
import { ObserveApplicationHealth } from './application-health';

describe('Health worker lifecycle', () => {
  afterEach(() => jest.useRealTimers());
  it('is off unless explicitly enabled and rejects invalid configuration', () => {
    const worker = { batch: jest.fn() } as unknown as ObserveApplicationHealth;
    const config = new ConfigService();
    const value = jest.spyOn(config, 'get').mockReturnValue(undefined);
    new HealthMonitorLifecycle(worker, config).onModuleInit();
    expect(worker.batch).not.toHaveBeenCalled();
    value.mockReturnValue('yes');
    expect(() =>
      new HealthMonitorLifecycle(worker, config).onModuleInit()
    ).toThrow();
  });
  it('does not overlap batches and shutdown waits for the current work without scheduling more', async () => {
    jest.useFakeTimers();
    let finish: (value: {
      after: null;
      recorded: number;
      failed: number;
    }) => void = () => undefined;
    const worker = {
      batch: jest.fn(
        () =>
          new Promise<{ after: null; recorded: number; failed: number }>(
            (resolve) => {
              finish = resolve;
            }
          )
      ),
    } as unknown as ObserveApplicationHealth;
    const config = new ConfigService();
    jest.spyOn(config, 'get').mockReturnValue('true');
    const lifecycle = new HealthMonitorLifecycle(worker, config);
    lifecycle.onModuleInit();
    jest.advanceTimersByTime(60_000);
    expect(worker.batch).toHaveBeenCalledTimes(1);
    let stopped = false;
    const shutdown = lifecycle.onModuleDestroy().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish({ after: null, recorded: 1, failed: 0 });
    await shutdown;
    jest.advanceTimersByTime(60_000);
    expect(stopped).toBe(true);
    expect(worker.batch).toHaveBeenCalledTimes(1);
  });
});
