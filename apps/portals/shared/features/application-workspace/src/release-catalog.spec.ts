import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ok, type Result } from '@sdk/kernel/standard';
import type {
  PublishedRelease,
  ReleasePage,
} from '@domains/catalog/versioning';
import { ReleaseCatalogService } from './application/release-catalog.service';
import { RELEASE_CATALOG } from './application/release-workspace.port';

const release: PublishedRelease = {
  id: '10000000-0000-4000-8000-000000000001',
  applicationId: '10000000-0000-4000-8000-000000000002',
  applicationSlug: 'example',
  applicationName: 'Example',
  revision: 1,
  publishedAt: 1,
  version: '1.0.0',
  title: 'First release',
  description: 'Available now.',
  channel: 'stable',
  type: 'major',
  releasedOn: '2026-01-01',
  changes: [],
};

describe('release catalog cancellation', () => {
  it('cancels current and previous reads and removes completed metadata when closed', () => {
    const current = new Subject<Result<PublishedRelease, Error>>();
    const previous = new Subject<Result<ReleasePage, Error>>();
    const port = {
      find: jest.fn(() => current),
      browse: jest.fn(() => previous),
    };
    TestBed.configureTestingModule({
      providers: [
        ReleaseCatalogService,
        { provide: RELEASE_CATALOG, useValue: port },
      ],
    });
    const service = TestBed.inject(ReleaseCatalogService);
    service.open('example', '1.0.0', 1);
    current.next(ok(release));
    expect(service.items()).toEqual([release]);
    expect(previous.observed).toBe(true);
    service.close();
    expect(current.observed).toBe(false);
    expect(previous.observed).toBe(false);
    current.next(ok(release));
    previous.next(ok({ items: [release], total: 1, page: 1 }));
    expect(service.items()).toEqual([]);
    expect(service.previous()).toEqual([]);
    expect(service.total()).toBe(0);
    expect(service.previousTotal()).toBe(0);
    expect(service.loading()).toBe(false);
    expect(service.previousLoading()).toBe(false);
    expect(service.error()).toBe('');
    expect(service.previousError()).toBe('');
  });

  it('loads a newly permitted selection without carrying previous-release metadata', () => {
    const port = {
      find: jest.fn(() => of(ok(release))),
      browse: jest.fn(() => of(ok({ items: [release], page: 1, total: 1 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        ReleaseCatalogService,
        { provide: RELEASE_CATALOG, useValue: port },
      ],
    });
    const service = TestBed.inject(ReleaseCatalogService);
    service.open('example', '1.0.0', 1);
    expect(service.previous()).toEqual([release]);
    service.close();
    expect(service.previous()).toEqual([]);
    service.open('example', null, 1, 'stable');
    expect(service.items()).toEqual([release]);
    expect(service.previous()).toEqual([]);
    expect(port.browse).toHaveBeenLastCalledWith('example', 1, {
      channel: 'stable',
    });
  });
});
