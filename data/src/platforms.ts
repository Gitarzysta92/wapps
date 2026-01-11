import { PlatformOptionDto } from '@domains/catalog/compatibility';

export const platforms: PlatformOptionDto[] = [
  { id: 0, name: 'Web', slug: 'web' },
  { id: 1, name: 'IOS', slug: 'ios' },
  { id: 2, name: 'Android', slug: 'android' },
  { id: 3, name: 'Windows', slug: 'windows' },
  { id: 4, name: 'Linux', slug: 'linux' },
  { id: 5, name: 'MacOS', slug: 'macos' },
];
