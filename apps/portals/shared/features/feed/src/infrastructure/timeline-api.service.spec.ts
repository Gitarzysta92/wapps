import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { TimelineMissingError } from '@domains/feed';
import { TimelineApiService } from './timeline-api.service';
import { TIMELINE_URL } from '../application/timeline.port';

describe('Timeline API adapter', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TimelineApiService,
        { provide: TIMELINE_URL, useValue: '' },
      ],
    })
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('requests only the selected application and validates the returned context', async () => {
    const read = () =>
      firstValueFrom(TestBed.inject(TimelineApiService).read('example', null));
    const page = {
      application: {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Example',
        slug: 'example',
      },
      items: [],
      after: null,
    };
    const accepted = read();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/applications/example/timeline')
      .flush(page);
    expect((await accepted).ok).toBe(true);
    const wrong = read();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/applications/example/timeline')
      .flush({ ...page, application: { ...page.application, slug: 'other' } });
    expect((await wrong).ok).toBe(false);
  });
  it('distinguishes current absence from a source outage without fabricating an empty page', async () => {
    for (const status of [404, 503]) {
      const response = firstValueFrom(
        TestBed.inject(TimelineApiService).read('example', null)
      );
      TestBed.inject(HttpTestingController)
        .expectOne('/api/applications/example/timeline')
        .flush({}, { status, statusText: 'Failed' });
      const result = await response;
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error instanceof TimelineMissingError).toBe(
          status === 404
        );
    }
  });
});
