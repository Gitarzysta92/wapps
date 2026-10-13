import { parseTimelinePage } from './timeline';
import { parseExploreRead } from './explore';

const id = '10000000-0000-4000-8000-000000000001';
describe('Timeline boundary', () => {
  it('accepts strict public application context without private fields', () => {
    const page = {
      application: { id, slug: 'example', name: 'Example' },
      items: [],
      after: null,
    };
    expect(parseTimelinePage(page)).toEqual(page);
    expect(() =>
      parseTimelinePage({
        ...page,
        application: { ...page.application, ownerIdentityId: 'owner' },
      })
    ).toThrow();
    expect(() => parseTimelinePage({ ...page, through: id })).toThrow();
  });
  it('strictly accepts a canonical application filter, independently from kind', () => {
    expect(
      parseExploreRead({ after: null, applicationId: id }, ['discussion'])
        .applicationId
    ).toBe(id);
    expect(
      parseExploreRead({ after: null, kind: 'review', applicationId: id }, [
        'review',
      ]).selectedKind
    ).toBe('review');
    for (const input of [
      { after: null, applicationId: 'slug' },
      { after: null, applicationId: id, tenantId: 'other' },
      { after: null, applicationId: id, kind: 'article' },
      { after: null, applicationId: undefined },
    ])
      expect(() =>
        parseExploreRead(input, ['article', 'discussion'])
      ).toThrow();
  });
});
