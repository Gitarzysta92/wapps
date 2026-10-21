import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthNotFoundError } from '@domains/reliability';
import { APPLICATION_HEALTH } from '../application/health.port';
import { provideApplicationHealth } from '../health.providers';

const report = {
  application: {
    id: '10000000-0000-4000-8000-000000000001',
    slug: 'example',
    name: 'Example',
  },
  asOf: Date.UTC(2026, 9, 13),
  monitors: [],
};
describe('HTTP health adapter', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideApplicationHealth(''),
      ],
    })
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it('validates the real same-origin response without demo fallback', () => {
    const next = jest.fn();
    TestBed.inject(APPLICATION_HEALTH).read('example').subscribe(next);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/catalog/application-health/example')
      .flush(report);
    expect(next).toHaveBeenCalledWith({ ok: true, value: report });
  });
  it('does not accept another application or fabricated observations', () => {
    const next = jest.fn();
    TestBed.inject(APPLICATION_HEALTH).read('other').subscribe(next);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/catalog/application-health/other')
      .flush(report);
    expect(next.mock.calls[0][0].ok).toBe(false);
  });
  it('maps an absent parent and rejects an injected path before HTTP', () => {
    const next = jest.fn();
    TestBed.inject(APPLICATION_HEALTH).read('example').subscribe(next);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/catalog/application-health/example')
      .flush({}, { status: 404, statusText: 'Missing' });
    expect(next.mock.calls[0][0].error).toBeInstanceOf(HealthNotFoundError);
    TestBed.inject(APPLICATION_HEALTH).read('../private').subscribe(next);
    expect(next.mock.calls[1][0].ok).toBe(false);
  });
});
