import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { DiscoveryReviewsClient } from './discovery-reviews.client';

const id = '10000000-0000-4000-8000-000000000001';
const review = {
  id: '10000000-0000-4000-8000-000000000002',
  bindingKey: 'wapps:application:' + id,
  revision: 1,
  contentRevision: 1,
  withdrawn: false,
  hidden: false,
  moderationReason: null,
  content: { displayName: 'Public member', rating: 4, text: 'Useful.' },
  createdAt: 1000,
  updatedAt: 1000,
  helpfulCount: 0,
  helpful: false,
  reported: false,
  mine: false,
  canModerate: false,
  openReports: null,
};
const page = {
  items: [review],
  next: null,
  mine: null,
  canModerate: false,
  summary: { total: 1, average: 4, distribution: [0, 0, 0, 1, 0] },
};

describe('discovery Review owner integration', () => {
  const get = jest.fn();
  const client = new DiscoveryReviewsClient(
    { get } as unknown as HttpService,
    new ConfigService({ DISCUSSION_URL: 'http://owner.test' })
  );
  beforeEach(() => {
    get.mockReset().mockReturnValue(of({ data: page }));
  });
  it('maps the generic owner page into the existing discovery preview', async () => {
    expect(await client.read(id)).toEqual({
      total: 1,
      rating: 4,
      preview: {
        id: review.id,
        byline: review.content.displayName,
        rating: 4,
        text: 'Useful.',
        publishedAt: 1000,
      },
    });
    expect(get).toHaveBeenCalledWith(
      'http://owner.test/api/reviews?bindingKey=wapps%3Aapplication%3A' + id,
      expect.objectContaining({
        maxRedirects: 0,
        timeout: 5000,
        headers: { Accept: 'application/json' },
      })
    );
  });
  it.each([
    review.bindingKey.toUpperCase(),
    'another-consumer:' + id,
    'wapps:application:' + review.id,
  ])('rejects a response from a different key %s', async (bindingKey) => {
    get.mockReturnValue(
      of({ data: { ...page, items: [{ ...review, bindingKey }] } })
    );
    await expect(client.read(id)).rejects.toThrow();
  });
  it('rejects the retired owning response shape', async () => {
    const fields: Partial<typeof review> = { ...review };
    delete fields.bindingKey;
    get.mockReturnValue(
      of({ data: { ...page, items: [{ ...fields, applicationId: id }] } })
    );
    await expect(client.read(id)).rejects.toThrow();
  });
});
