import { EstimatedUserSpanOptionDto } from '../libs/domains/catalog/metrics/src/application/models/estimated-user-span-option.dto';

export const userSpans: EstimatedUserSpanOptionDto[] = [
  { id: 0, name: '0-1000', slug: '0-1000', from: 0, to: 1000 },
  { id: 1, name: '1000-10000', slug: '1000-10000', from: 1000, to: 10000 },
  { id: 2, name: '10000-100000', slug: '10000-100000', from: 10000, to: 100000 },
  { id: 3, name: '100000-1000000', slug: '100000-1000000', from: 100000, to: 1000000 },
  { id: 4, name: '1000000+', slug: '1000000-plus', from: 1000000, to: Number.MAX_SAFE_INTEGER },
];
