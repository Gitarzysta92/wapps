export type ScrapedApp = {
  name: string;
  detailsLink: string;
  tags: string[];
  description: string;
  links: Array<{ id: number; link: string }>;
  assets: Array<{ src: string, type: 'logo' | 'gallery' }>;
  slug: string
} 