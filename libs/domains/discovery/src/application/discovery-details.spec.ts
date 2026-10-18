import { parseDiscoveryDetails, parseDiscoveryTags } from './discovery-details';
import { parsePublicDiscovery, parsePublicDiscoveryQuery, selectPublicDiscovery } from './public-discovery';

const id = '10000000-0000-4000-8000-000000000001';
describe('search card metadata', () => {
  it('rejects foreign kinds, private fields, unsafe images and impossible ratings', () => {
    const details = { kind: 'application', logoUrl: null, reviews: { total: 0, rating: null, preview: null } };
    expect(parseDiscoveryDetails(details, 'application')).toEqual(details);
    for (const value of [
      { ...details, kind: 'article' },
      { ...details, ownerIdentityId: 'private' },
      { ...details, logoUrl: 'javascript:alert(1)' },
      { ...details, logoUrl: 'https://secret:password@example.test/logo' },
      { ...details, reviews: { total: 0, rating: 5, preview: null } },
      { ...details, reviews: { total: 1, rating: 6, preview: null } },
    ]) expect(() => parseDiscoveryDetails(value, 'application')).toThrow();
  });
  it('keeps one display destination per tag and rejects duplicate or private fields', () => {
    const tag = { slug: 'work', name: 'Work tools' };
    expect(parseDiscoveryTags([tag])).toEqual([tag]);
    expect(() => parseDiscoveryTags([tag, tag])).toThrow();
    expect(() => parseDiscoveryTags([{ ...tag, owner: 'private' }])).toThrow();
  });
  it('masks mature and unclassified suite members without mutating source metadata or totals', () => {
    const applications = ['general', 'mature', undefined].map((classification, i) => ({
      id: id.slice(0, -1) + (i + 2), slug: 'app-' + i, name: 'App ' + i, logoUrl: null,
      ...(classification ? { classification } : {}),
    }));
    const result = parsePublicDiscovery({ groups: [{ kind: 'suite', page: 1, pageSize: 20, total: 1, totalPages: 1,
      items: [{ id, revision: 1, slug: null, title: 'Suite', summary: '', at: 1, categories: [], tags: [], classification: 'general',
        details: { kind: 'suite', applicationCount: 3, applications },
      }],
    }] }, parsePublicDiscoveryQuery({ type: 'suite' }));
    const [masked] = selectPublicDiscovery(result, [], false);
    expect(masked.items[0].details).toMatchObject({ applicationCount: 3, applications: [applications[0]] });
    expect(masked.total).toBe(1);
    expect(result.groups[0].items[0].details).toMatchObject({ applications });
    expect(selectPublicDiscovery(result, [], true)[0].items[0].details).toMatchObject({ applications });
    expect(selectPublicDiscovery(result, [], false)[0].items[0].details).toEqual(masked.items[0].details);
  });
});
