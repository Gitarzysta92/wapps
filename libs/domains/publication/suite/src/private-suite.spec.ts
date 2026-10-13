import {
  parsePrivateSuite,
  parseSuiteFields,
  parseSuiteReceipt,
  suiteId,
} from './private-suite';
const id = '019a0010-0000-7000-8000-000000000001';
const fields = {
  title: '  Reading  ',
  description: '  Tools  ',
  applicationIds: [id],
};
describe('private suite contracts', () => {
  it('normalizes text and preserves ordered stable references', () => {
    expect(parseSuiteFields(fields)).toEqual({
      ...fields,
      title: 'Reading',
      description: 'Tools',
    });
  });
  it.each([
    { ...fields, title: '' },
    { ...fields, title: 'a'.repeat(101) },
    { ...fields, description: 'x'.repeat(1001) },
    { ...fields, applicationIds: [] },
    { ...fields, applicationIds: [id, id] },
    { ...fields, applicationIds: ['a-slug'] },
    { ...fields, visibility: 'public' },
    { ...fields, title: 'Bad\u0000text' },
  ])('rejects invalid fields %j', (input) =>
    expect(() => parseSuiteFields(input)).toThrow()
  );
  it('rejects oversized arrays before processing their contents', () => {
    expect(() =>
      parseSuiteFields({ ...fields, applicationIds: Array(51).fill(id) })
    ).toThrow('1 and 50');
  });
  it('rejects invalid snapshots and receipts', () => {
    const snapshot = {
      ...fields,
      id,
      revision: 1,
      visibility: 'private',
      createdAt: 100,
      updatedAt: 100,
    };
    expect(parsePrivateSuite(snapshot).revision).toBe(1);
    for (const change of [
      { visibility: 'public' },
      { revision: 0 },
      { updatedAt: 99 },
    ])
      expect(() => parsePrivateSuite({ ...snapshot, ...change })).toThrow();
    expect(() =>
      parseSuiteReceipt({ id, revision: 1, deleted: 'false' })
    ).toThrow();
    expect(() => suiteId(id.toUpperCase())).toThrow();
  });
});
