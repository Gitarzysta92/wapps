import { Logger } from '@nestjs/common';
import { CompleteAccountExport } from '@wapps/account';
import { AccountExportWorker } from './account-export-worker';

describe('account export runtime pump', () => {
  let once: jest.SpyInstance, pump: AccountExportWorker;
  beforeEach(() => {
    jest.useFakeTimers();
    once = jest
      .spyOn(CompleteAccountExport.prototype, 'once')
      .mockResolvedValue('idle');
    const worker = Object.create(
      CompleteAccountExport.prototype
    ) as CompleteAccountExport;
    pump = new AccountExportWorker(worker);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await pump.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('starts once, drains bounded batches and polls persisted idle work', async () => {
    once.mockResolvedValue('completed');
    pump.onModuleInit();
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    expect(once).toHaveBeenCalledTimes(4);
    once.mockResolvedValue('idle');
    await jest.advanceTimersByTimeAsync(1000);
    expect(once).toHaveBeenCalledTimes(5);
    await pump.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2000);
    expect(once).toHaveBeenCalledTimes(5);
  });
  it('cancels active capture on shutdown without starting overlapping work', async () => {
    once.mockImplementation(
      (signal?: AbortSignal) =>
        new Promise((resolve) =>
          signal?.addEventListener('abort', () => resolve('lease-lost'), {
            once: true,
          })
        )
    );
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(4000);
    expect(once).toHaveBeenCalledTimes(1);
    await pump.onModuleDestroy();
    expect(once.mock.calls[0][0].aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(4000);
    expect(once).toHaveBeenCalledTimes(1);
  });
  it('preserves durable retries after infrastructure failure and reports terminal failures', async () => {
    once
      .mockRejectedValueOnce(new Error('SQL unavailable'))
      .mockResolvedValueOnce('failed')
      .mockResolvedValue('idle');
    pump.onModuleInit();
    await jest.advanceTimersByTimeAsync(1000);
    expect(once).toHaveBeenCalledTimes(3);
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
  });
});
