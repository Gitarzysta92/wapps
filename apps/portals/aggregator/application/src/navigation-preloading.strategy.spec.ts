import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NavigationPreloadingStrategy } from './navigation-preloading.strategy';

describe('Navigation preloading', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('only downloads opted-in destinations, and waits for an idle opportunity', () => {
    let idle!: IdleRequestCallback;
    const request = window.requestIdleCallback;
    const cancel = window.cancelIdleCallback;
    window.requestIdleCallback = jest.fn(callback => { idle = callback; return 1; });
    window.cancelIdleCallback = jest.fn();
    try {
      const strategy = TestBed.inject(NavigationPreloadingStrategy);
      const load = jest.fn(() => of('Discover'));
      const result = jest.fn();
      strategy.preload({}, load).subscribe();
      expect(window.requestIdleCallback).not.toHaveBeenCalled();
      strategy.preload({ data: { preload: true } }, load).subscribe(result);
      expect(load).not.toHaveBeenCalled();
      idle({ didTimeout: false, timeRemaining: () => 10 });
      expect(load).toHaveBeenCalledTimes(1);
      expect(result).toHaveBeenCalledWith('Discover');
    } finally {
      window.requestIdleCallback = request;
      window.cancelIdleCallback = cancel;
    }
  });

  it('cancels pending fallback work and tolerates a failed background download', () => {
    jest.useFakeTimers();
    const strategy = TestBed.inject(NavigationPreloadingStrategy);
    const load = jest.fn(() => throwError(() => new Error('Offline')));
    const pending = strategy.preload({ data: { preload: true } }, load).subscribe();
    pending.unsubscribe();
    jest.runAllTimers();
    expect(load).not.toHaveBeenCalled();
    const error = jest.fn();
    strategy.preload({ data: { preload: true } }, load).subscribe({ error });
    jest.runAllTimers();
    expect(load).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});
