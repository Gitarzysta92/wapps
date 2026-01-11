import { MonetizationOptionDto } from '@domains/catalog/pricing';

export const monetizationModels: MonetizationOptionDto[] = [
  { id: 0, name: 'Free', slug: 'free' },
  { id: 1, name: 'Freemium', slug: 'freemium' },
  { id: 2, name: 'Subscription', slug: 'subscription' },
  { id: 3, name: 'Ad-based', slug: 'ad-based' },
  { id: 4, name: 'One time purchase', slug: 'one-time-purchase' },
  { id: 5, name: 'Fees', slug: 'fees' },
];
