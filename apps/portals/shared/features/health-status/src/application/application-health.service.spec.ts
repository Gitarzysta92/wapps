import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  HealthNotFoundError,
  type ApplicationHealthReport,
} from '@domains/reliability';
import { ApplicationHealthService } from './application-health.service';
import { APPLICATION_HEALTH } from './health.port';

const report: ApplicationHealthReport = {
  application: {
    id: '10000000-0000-4000-8000-000000000001',
    slug: 'example',
    name: 'Example',
  },
  asOf: Date.UTC(2026, 9, 13),
  monitors: [],
};
function setup() {
  const port = {
    read: jest
      .fn<Observable<Result<ApplicationHealthReport, Error>>, [string]>()
      .mockReturnValue(of(ok(report))),
  };
  TestBed.configureTestingModule({
    providers: [
      ApplicationHealthService,
      { provide: APPLICATION_HEALTH, useValue: port },
    ],
  });
  return { port, service: TestBed.inject(ApplicationHealthService) };
}
describe('HTTP health page state', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('loads nothing without a route and cancels held requests on navigation', () => {
    const f = setup(),
      pending = new Subject<Result<ApplicationHealthReport, Error>>();
    expect(f.port.read).not.toHaveBeenCalled();
    f.port.read.mockReturnValueOnce(pending);
    f.service.open('first');
    expect(f.service.loading()).toBe(true);
    f.service.open('example');
    expect(pending.observed).toBe(false);
    pending.next(
      ok({ ...report, application: { ...report.application, slug: 'first' } })
    );
    expect(f.service.report()?.application.slug).toBe('example');
  });
  it('keeps an unconfigured application unknown and distinguishes not-found and unavailable', () => {
    const f = setup();
    f.service.open('example');
    expect(f.service.status()).toBe('unknown');
    f.port.read.mockReturnValueOnce(of(err(new HealthNotFoundError('Absent'))));
    f.service.reload();
    expect(f.service.report()).toBeNull();
    expect(f.service.notFound()).toBe(true);
    f.port.read.mockReturnValueOnce(of(err(new Error('Unavailable'))));
    f.service.reload();
    expect(f.service.notFound()).toBe(false);
    expect(f.service.error()).toBe('Unavailable');
    f.service.reload();
    expect(f.service.error()).toBe('');
    expect(f.service.report()).toEqual(report);
  });
  it('rejects a reused slug belonging to another canonical application and recovers on retry', () => {
    const f = setup();
    const currentId = '10000000-0000-4000-8000-000000000002';
    f.service.open('example', currentId);
    expect(f.service.report()).toBeNull();
    expect(f.service.error()).toContain('does not match');
    f.port.read.mockReturnValueOnce(of(ok({
      ...report, application: { ...report.application, id: currentId },
    })));
    f.service.reload();
    expect(f.service.report()?.application.id).toBe(currentId);
    expect(f.service.error()).toBe('');
  });
  it('refreshes periodically, removes old evidence on outage and stops on destruction', fakeAsync(() => {
    const f = setup();
    f.service.open('example');
    f.port.read.mockReturnValueOnce(of(err(new Error('Unavailable'))));
    tick(60_000);
    expect(f.port.read).toHaveBeenCalledTimes(2);
    expect(f.service.report()).toBeNull();
    expect(f.service.error()).toBe('Unavailable');
    TestBed.resetTestingModule();
    tick(60_000);
    expect(f.port.read).toHaveBeenCalledTimes(2);
  }));
  it('clears a hidden parent and prevents the periodic refresh from restoring it', fakeAsync(() => {
    const f = setup();
    f.service.open('example');
    expect(f.service.report()).toEqual(report);
    const pending = new Subject<Result<ApplicationHealthReport, Error>>();
    f.port.read.mockReturnValueOnce(pending);
    f.service.reload();
    f.service.open('');
    expect(pending.observed).toBe(false);
    pending.next(ok(report));
    tick(120_000);
    expect(f.service.report()).toBeNull();
    expect(f.port.read).toHaveBeenCalledTimes(2);
    TestBed.resetTestingModule();
  }));
});
