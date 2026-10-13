import {
  appContent,
  appSnapshot,
  editorialEvent,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import {
  inspectEditorialProjection,
  InvalidEditorialSnapshot,
  materializeEditorial,
  projectEditorialSnapshot,
  parseEditorialContent,
} from './editorial-materialization';

describe('Editorial snapshot materialization', () => {
  it('binds classification to canonical content while preserving unclassified legacy bytes', () => {
    const legacy = projectEditorialSnapshot(appSnapshot());
    expect(legacy.content).not.toHaveProperty('classification');
    const rated = projectEditorialSnapshot(
      appSnapshot({ content: { ...appContent(), classification: 'mature' } })
    );
    expect(rated.content).toHaveProperty('classification', 'mature');
    expect(rated.fingerprint).not.toBe(legacy.fingerprint);
    expect(inspectEditorialProjection(rated)).toEqual(rated);
    expect(() =>
      inspectEditorialProjection({ ...legacy, content: rated.content })
    ).toThrow();
    expect(() =>
      parseEditorialContent('app', { ...appContent(), classification: 'safe' })
    ).toThrow();
  });
  it('allows retained scrubbed application values only for explicit private export validation', () => {
    const retained = {
      ...appContent(),
      name: '',
      website: null,
      description: null,
      logoUrl: null,
      bannerUrl: null,
    };
    expect(parseEditorialContent('app', retained, true)).toEqual(retained);
    expect(() => parseEditorialContent('app', retained)).toThrow();
    expect(() =>
      projectEditorialSnapshot(appSnapshot({ content: retained }))
    ).toThrow();
    expect(() =>
      parseEditorialContent(
        'app',
        { ...retained, description: 'incomplete scrub' },
        true
      )
    ).toThrow();
    expect(
      projectEditorialSnapshot(appSnapshot({ deletedAt: 10, content: null }))
        .content
    ).toBeNull();
  });
  it('is deterministic across field and relation order without embedding external labels', () => {
    const a = appSnapshot({
      content: { ...appContent(), tagIds: [editorialId(2), editorialId(3)] },
    });
    const b = appSnapshot({
      content: { ...appContent(), tagIds: [editorialId(3), editorialId(2)] },
    });
    expect(projectEditorialSnapshot(a)).toEqual(projectEditorialSnapshot(b));
    expect(projectEditorialSnapshot(a).content).not.toHaveProperty('tags');
    expect(inspectEditorialProjection(projectEditorialSnapshot(a))).toEqual(
      projectEditorialSnapshot(a)
    );
  });

  it('publishes a complete newer snapshot for an older wake-up event', async () => {
    const reader = {
      read: jest.fn().mockResolvedValue(appSnapshot({ revision: 4 })),
    };
    const store = {
      publish: jest.fn().mockResolvedValue('published'),
      find: jest.fn(),
    };
    expect(
      await materializeEditorial(editorialEvent(1).payload, reader, store)
    ).toBe('published');
    expect(store.publish).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 4, content: appContent() })
    );
  });

  it('keeps deletion identity/revision while removing the content body', () => {
    const projection = projectEditorialSnapshot(
      appSnapshot({ revision: 2, deletedAt: 100, content: null })
    );
    expect(projection).toMatchObject({
      resourceId: editorialId(),
      revision: 2,
      deletedAt: 100,
      content: null,
    });
  });

  it('treats a behind replica as retriable without publishing an old revision', async () => {
    const store = { publish: jest.fn(), find: jest.fn() };
    await expect(
      materializeEditorial(
        editorialEvent(2).payload,
        { read: async () => appSnapshot() },
        store
      )
    ).rejects.toThrow('has not reached');
    expect(store.publish).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'unknown' },
    { revision: 0 },
    { revision: Number.MAX_SAFE_INTEGER + 1 },
    { resourceId: 'invalid' },
    { tenantId: '' },
    { tenantId: ' tenant' },
    { content: null },
    { deletedAt: 0 },
    { deletedAt: -1, content: null },
    { content: { ...appContent(), description: 'x'.repeat(32769) } },
    { content: { ...appContent(), tagIds: [editorialId(2), editorialId(2)] } },
    {
      content: { ...appContent(), tagIds: new Array(51).fill(editorialId(2)) },
    },
    { content: { ...appContent(), categoryId: 'missing-id' } },
    { content: { ...appContent(), ownerIdentityId: 'injected' } },
    {
      content: { ...appContent(), updatedAtSql: '2026-02-30 00:00:00.000000' },
    },
    { content: { ...appContent(), isPwa: 'true' } },
    { content: { ...appContent(), rating: NaN } },
  ])(
    'rejects invalid source snapshots before generating a view %#',
    (invalid) => {
      expect(() =>
        projectEditorialSnapshot({ ...appSnapshot(), ...invalid })
      ).toThrow(InvalidEditorialSnapshot);
    }
  );

  it.each([{ tenantId: 'other' }, { resourceId: editorialId(2) }])(
    'rejects a reader returning another resource scope %#',
    async (changed) => {
      const store = { publish: jest.fn(), find: jest.fn() };
      await expect(
        materializeEditorial(
          editorialEvent().payload,
          { read: async () => appSnapshot(changed) },
          store
        )
      ).rejects.toThrow('does not match');
      expect(store.publish).not.toHaveBeenCalled();
    }
  );

  it('detects mutated projected content even when the stored fingerprint was left unchanged', () => {
    const projection = projectEditorialSnapshot(appSnapshot());
    expect(() =>
      inspectEditorialProjection({
        ...projection,
        content: { ...appContent(), name: 'Corrupt' },
      })
    ).toThrow('Conflicting projection');
  });

  it('preserves exact SQL microseconds without inventing a timezone', () => {
    const projection = projectEditorialSnapshot(appSnapshot());
    expect(projection.content).toEqual(
      expect.objectContaining({ createdAtSql: '2026-10-11 00:00:00.123456' })
    );
  });
});
