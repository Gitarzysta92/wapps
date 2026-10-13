import { classificationFields, permitsContent } from './index';

describe('reviewed content classification', () => {
  it('preserves missing legacy classification without fabricating a rating', () => {
    expect(classificationFields(undefined)).toEqual({});
    expect(JSON.stringify(classificationFields(undefined))).toBe('{}');
  });
  it.each(['general', 'mature'])(
    'accepts the explicit %s classification',
    (value) => {
      expect(classificationFields(value)).toEqual({ classification: value });
    }
  );
  it.each([null, '', 'General', 'adult', true, {}, ['general']])(
    'rejects invalid classification %j',
    (value) => {
      expect(() => classificationFields(value, TypeError)).toThrow(TypeError);
    }
  );
  it('hides mature and unclassified content unless explicitly enabled', () => {
    for (const classification of [undefined, 'general', 'mature'] as const) {
      const content = classificationFields(classification);
      expect(permitsContent(content, false)).toBe(classification === 'general');
      expect(permitsContent(content, true)).toBe(true);
    }
  });
});
