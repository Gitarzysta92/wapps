import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { DiscoveryPreviewService } from '@portals/shared/features/search';
import { HomeSearchProviderService } from './home-search-provider.service';

describe('home preview navigation', () => {
  it('preserves canonical identity and totals while mapping detail and group routes', async () => {
    const entry = {
      id: '10000000-0000-4000-8000-000000000001',
      revision: 3,
      slug: 'real-app',
      name: 'Real app',
      description: 'Content',
      tags: [{ name: 'Topic', slug: 'topic' }],
    };
    TestBed.configureTestingModule({
      providers: [
        HomeSearchProviderService,
        {
          provide: DiscoveryPreviewService,
          useValue: {
            preview: () =>
              of({
                search: 'Real',
                total: 24,
                groups: [
                  {
                    kind: 'applications',
                    total: 20,
                    hiddenCount: 2,
                    entries: [entry],
                  },
                  {
                    kind: 'articles',
                    total: 2,
                    hiddenCount: 0,
                    entries: [{ ...entry, slug: 'real-article' }],
                  },
                  {
                    kind: 'suites',
                    total: 2,
                    hiddenCount: 1,
                    entries: [{ ...entry, slug: entry.id }],
                  },
                ],
              }),
          },
        },
      ],
    });
    const result = await firstValueFrom(
      TestBed.inject(HomeSearchProviderService).search({ search: 'Real' })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful preview');
    expect(result.value).toMatchObject({
      itemsNumber: 24,
      link: '/discover',
      query: { search: 'Real' },
      groups: [
        {
          type: 'applications',
          link: '/discover',
          total: 20,
          hiddenCount: 2,
          entries: [
            {
              id: entry.id,
              revision: 3,
              link: '/apps/real-app',
              rating: undefined,
              tags: entry.tags,
            },
          ],
        },
        { type: 'articles', entries: [{ link: '/articles/real-article' }] },
        { type: 'suites', entries: [{ link: '/suites/' + entry.id }] },
      ],
    });
  });
});
