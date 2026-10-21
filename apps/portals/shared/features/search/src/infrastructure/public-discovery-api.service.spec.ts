import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { parsePublicDiscoveryQuery } from '@domains/discovery';
import { PUBLIC_DISCOVERY } from '../application/public-discovery.port';
import { providePublicDiscovery } from '../public-discovery.providers';

describe('public discovery HTTP adapter', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...providePublicDiscovery(''),
      ],
    })
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it('sends bounded normalized query state to the BFF', () => {
    const next = jest.fn();
    TestBed.inject(PUBLIC_DISCOVERY)
      .search(
        parsePublicDiscoveryQuery({
          type: 'article',
          q: 'Guide',
          articlePage: '2',
          pageSize: '10',
          tag: 'offline',
          tags: ['privacy', 'web'],
        })
      )
      .subscribe(next);
    const request = TestBed.inject(HttpTestingController).expectOne(
      (r) => r.url === '/api/catalog/discover'
    );
    expect(request.request.params.get('articlePage')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('tags')).toBe('offline,privacy,web');
    request.flush({
      groups: [
        {
          kind: 'article',
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
          items: [],
        },
      ],
    });
    expect(next.mock.calls[0][0].ok).toBe(true);
  });
  it('rejects partial groups, wrong pages and an unavailable source without demo fallback', () => {
    const next = jest.fn();
    TestBed.inject(PUBLIC_DISCOVERY)
      .search(parsePublicDiscoveryQuery({}))
      .subscribe(next);
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === '/api/catalog/discover')
      .flush({ groups: [] });
    expect(next.mock.calls[0][0].ok).toBe(false);
    TestBed.inject(PUBLIC_DISCOVERY)
      .search(parsePublicDiscoveryQuery({}))
      .subscribe(next);
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === '/api/catalog/discover')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(next.mock.calls[1][0].ok).toBe(false);
  });
  it('rejects an origin carrying a path or credentials', () => {
    expect(() =>
      providePublicDiscovery('http://user:pass@example.test')
    ).toThrow();
    expect(() =>
      providePublicDiscovery('http://example.test/private')
    ).toThrow();
  });
});
