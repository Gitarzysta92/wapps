import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  applicationReviewKey,
  applicationReviewTarget,
} from '@domains/community';
import { ReviewsController } from '@sdk/features/review/http';
import { ReviewsModule } from './reviews.module';

describe('Wapps Review owner boundary', () => {
  const id = '10000000-0000-4000-8000-00000000000a';
  it('registers only the generic resource controller', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ReviewsModule)
    ).toEqual([ReviewsController]);
    expect(Reflect.getMetadata(PATH_METADATA, ReviewsController)).toBe(
      'reviews'
    );
  });
  it('preserves historical UUID storage only for the exact Wapps key', () => {
    expect(applicationReviewTarget(applicationReviewKey(id))).toBe(id);
    for (const key of [
      id,
      'foreign:' + id,
      applicationReviewKey(id).toUpperCase(),
      applicationReviewKey(id) + '/extra',
    ])
      expect(() => applicationReviewTarget(key)).toThrow();
  });
});
