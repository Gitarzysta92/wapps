import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ExploreApiService } from './explore-api.service';
import { EXPLORE_URL } from '../application/explore.port';
describe('Explore API adapter', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ExploreApiService,
        { provide: EXPLORE_URL, useValue: '' },
      ],
    })
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('reads a validated current page', async () => {
    const result = firstValueFrom(TestBed.inject(ExploreApiService).read(null));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/explore')
      .flush({ items: [], after: null });
    expect((await result).ok).toBe(true);
  });
  it('rejects extra source data and never changes an outage into an empty feed', async () => {
    const result = firstValueFrom(TestBed.inject(ExploreApiService).read(null));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/explore')
      .flush({ items: [], after: null, through: { key: 'private' } });
    expect((await result).ok).toBe(false);
    const failure = firstValueFrom(
      TestBed.inject(ExploreApiService).read(null)
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/api/explore')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect((await failure).ok).toBe(false);
  });
});
