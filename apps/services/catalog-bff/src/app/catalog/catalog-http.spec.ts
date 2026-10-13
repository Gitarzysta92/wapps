import type { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AppModule } from '../app.module';

const id = '019a0010-0000-7000-8000-000000000001';
const facets = {
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
};
const record = {
  id,
  revision: 7,
  slug: 'application',
  name: 'Application',
  description: null,
  website: 'https://example.com',
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-11T00:00:00.123Z',
  updatedAt: '2026-10-11T00:00:00.123Z',
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};
const page = {
  items: [record],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  facets,
};

describe('catalog BFF HTTP and upstream contract', () => {
  const get = jest.fn();
  let app: INestApplication;
  let origin: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue({ get: () => 'http://editorial.test' })
      .overrideProvider(HttpService)
      .useValue({ get })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    get.mockReset().mockReturnValue(of({ data: page }));
  });
  const request = (path: string) => fetch(`${origin}/api/catalog/${path}`);

  it('forwards bounded filtering and preserves UUIDs and unknown reviews', async () => {
    const response = await request(
      'apps?category=tools&tags=free,open-source&search=two%20words'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(page);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      'http://editorial.test/api/catalog/apps',
      expect.objectContaining({
        params: expect.objectContaining({
          category: 'tools',
          tags: 'free,open-source',
          search: 'two words',
          pageSize: '20',
        }),
        timeout: 15000,
        maxRedirects: 0,
        maxContentLength: 16 * 1024 * 1024,
      })
    );
  });

  it.each([
    'page=1oops',
    'pageSize=101',
    'page=0',
    'sort=invalid',
    'tenantId=private',
    'category[slug]=c',
  ])('rejects invalid query before contacting Editorial: %s', async (query) => {
    expect((await request(`apps?${query}`)).status).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it('requests one slug, preserving its canonical ID', async () => {
    get.mockReturnValue(of({ data: record }));
    expect(await (await request('apps/application')).json()).toEqual(record);
    expect(get).toHaveBeenCalledWith(
      'http://editorial.test/api/catalog/apps/application',
      expect.any(Object)
    );
  });

  it('preserves a published 2048-character website and rejects oversized upstream URLs', async () => {
    const website = 'https://example.test/' + 'a'.repeat(2027);
    expect(website.length).toBe(2048);
    get.mockReturnValue(of({ data: { ...record, website } }));
    const response = await request('apps/application');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ website });
    get.mockReturnValue(of({ data: { ...record, website: website + 'a' } }));
    expect((await request('apps/application')).status).toBe(503);
  });

  it('resolves a bounded ID selection without confusing its route with an application slug', async () => {
    get.mockReturnValue(
      of({ data: { items: [{ ...record, slug: 'renamed' }] } })
    );
    const response = await request(`app-selection?ids=${id},${id}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      items: [{ ...record, slug: 'renamed' }],
    });
    expect(get).toHaveBeenCalledWith(
      'http://editorial.test/api/catalog/app-selection',
      expect.objectContaining({ params: { ids: id } })
    );
    get.mockReturnValue(of({ data: { ...record, slug: 'app-selection' } }));
    expect((await request('apps/app-selection')).status).toBe(200);
  });

  it.each([
    '',
    'ids=app',
    `ids=${id}&tenantId=private`,
    `ids=${id}&ids=${id}`,
    `ids=${id}%0A`,
    `ids=${new Array(51).fill(id).join(',')}`,
    `ids[0]=${id}`,
  ])(
    'rejects invalid ID selection input before upstream I/O: %s',
    async (query) => {
      expect((await request(`app-selection?${query}`)).status).toBe(400);
      expect(get).not.toHaveBeenCalled();
    }
  );

  it('preserves empty authoritative selections while rejecting malformed or failed responses', async () => {
    get.mockReturnValue(of({ data: { items: [] } }));
    expect(await (await request(`app-selection?ids=${id}`)).json()).toEqual({
      items: [],
    });
    for (const data of [
      {},
      { items: [record, record] },
      { items: [{ ...record, id: '019a0010-0000-7000-8000-000000000002' }] },
    ]) {
      get.mockReturnValue(of({ data }));
      expect((await request(`app-selection?ids=${id}`)).status).toBe(503);
    }
    for (const error of [
      new Error('timeout'),
      { isAxiosError: true, response: { status: 404 } },
      { isAxiosError: true, response: { status: 503 } },
    ]) {
      get.mockReturnValue(throwError(() => error));
      const response = await request(`app-selection?ids=${id}`);
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('2');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('distinguishes authoritative absence from projection or upstream failure', async () => {
    get.mockReturnValue(
      throwError(() => ({ isAxiosError: true, response: { status: 404 } }))
    );
    expect((await request('apps/absent')).status).toBe(404);
    for (const error of [
      new Error('timeout'),
      { isAxiosError: true, response: { status: 503 } },
    ]) {
      get.mockReturnValue(throwError(() => error));
      const response = await request('apps/application');
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('2');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it.each([
    { ...page, items: [] },
    { ...page, pageSize: 10 },
    { ...page, items: [{ ...record, id: 123 }] },
    { ...page, items: [{ ...record, reviews: { total: 0, rating: 0 } }] },
  ])(
    'rejects malformed upstream pages instead of returning success-shaped data',
    async (data) => {
      get.mockReturnValue(of({ data }));
      expect((await request('apps')).status).toBe(503);
    }
  );

  it('rejects a wrong detail slug and invalid category ancestry', async () => {
    get.mockReturnValue(of({ data: { ...record, slug: 'wrong' } }));
    expect((await request('apps/application')).status).toBe(503);
    get.mockReturnValue(
      of({
        data: {
          ...facets,
          categories: [{ id, name: 'Cycle', slug: 'cycle', parentId: id }],
        },
      })
    );
    expect((await request('categories/tree')).status).toBe(503);
  });

  it('returns current taxonomy independently of application projections', async () => {
    get.mockReturnValue(of({ data: facets }));
    expect(await (await request('facets')).json()).toEqual(facets);
    expect(get).toHaveBeenCalledWith(
      'http://editorial.test/api/catalog/facets',
      expect.any(Object)
    );
  });
});
