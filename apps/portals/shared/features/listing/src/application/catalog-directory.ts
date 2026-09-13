import { CATEGORIES, TAGS } from '@portals/shared/data';
import { CATALOG_ENTRIES, CatalogEntry, catalogFacets, normalizeCatalogFacet } from './catalog-listing';

export type CatalogDirectoryKind = 'category' | 'tag';
export interface CatalogDirectoryEntry {
  slug: string;
  name: string;
  description: string;
  parentName?: string;
  rootSlug?: string;
  appCount: number;
  featuredApps: readonly CatalogEntry[];
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'work-productivity': 'Organize projects, collaborate with your team, and make more room for focused work.',
  'engineering-development': 'Build, test, and ship software with tools for every stage of development.',
  'design-creative': 'Turn ideas into images, interfaces, video, and other creative work.',
  finance: 'Manage budgets, track spending, and plan your financial future.',
  'social-community': 'Connect with people, share ideas, and bring communities together.',
  'marketing-sales': 'Reach your audience, nurture customer relationships, and grow your business.',
  ai: 'Explore intelligent tools for writing, coding, research, and everyday tasks.',
  'health-fitness': 'Build healthier routines with tools for movement, mindfulness, and wellbeing.',
  travel: 'Plan journeys, organize bookings, and find your way in new places.',
  web3: 'Explore decentralized applications, digital assets, and blockchain tools.',
  ecommerce: 'Create an online store, manage products, and simplify selling.',
  'photo-editing': 'Edit, enhance, and organize photos, from quick adjustments to creative projects.',
  'project-management-software': 'Plan projects, assign tasks, and keep your team moving toward shared goals.',
  'budgeting-apps': 'Track everyday spending, organize expenses, and keep your budget in view.',
  'activity-tracking': 'Follow your workouts, record activity, and see your progress over time.',
  'meditation-apps': 'Make space for mindfulness with guided meditation and calming daily routines.',
  'vpn-client': 'Manage private connections and access online services through a virtual private network.',
  'ecommerce-platforms': 'Build a storefront and manage your catalog, orders, and online shopping experience.',
};
const TAG_DESCRIPTIONS: Record<string, string> = {
  web: 'Applications and tools built for use in a web browser.',
  mobile: 'Tools and experiences designed for phones and tablets.',
  desktop: 'Applications for working and creating on your computer.',
  ai: 'Tools that bring artificial intelligence into everyday workflows.',
  'machine-learning': 'Explore tools for training models and putting machine learning to work.',
  'data-science': 'Prepare, analyze, and explore data to uncover useful insights.',
  cloud: 'Tools for storing, running, and managing work in the cloud.',
  devops: 'Connect development and operations with automation and delivery tools.',
  security: 'Tools for protecting accounts, data, and digital work.',
  networking: 'Connect devices and services, and manage how they communicate.',
  database: 'Store, organize, and work with structured application data.',
  'web-development': 'Explore apps connected with building and working on the web.',
  'mobile-development': 'Discover apps connected with mobile products and workflows.',
  'desktop-development': 'Tools for building and maintaining desktop applications.',
  'game-development': 'Create interactive worlds, gameplay, and digital experiences.',
  'vr-development': 'Build immersive experiences for virtual reality.',
  'ar-development': 'Create experiences that bring digital content into the physical world.',
  blockchain: 'Explore distributed ledgers, smart contracts, and blockchain applications.',
  ecommerce: 'Tools for online stores, products, and shopping experiences.',
  marketing: 'Create campaigns, understand audiences, and share your message.',
  sales: 'Manage leads, customer conversations, and sales workflows.',
  finance: 'Track money, understand spending, and organize financial work.',
  education: 'Discover tools for learning, teaching, and sharing knowledge.',
  health: 'Explore apps for wellbeing, fitness, and healthier daily habits.',
  entertainment: 'Find tools and experiences for media, creativity, and play.',
  productivity: 'Organize tasks, streamline routines, and make progress on what matters.',
  social: 'Connect, communicate, and share with other people.',
  other: 'Explore apps and ideas that reach beyond the usual topics.',
};

/** Build directories from the full taxonomy, including topics with no listed apps. */
export function catalogDirectory(kind: CatalogDirectoryKind): CatalogDirectoryEntry[] {
  const facetKey = kind === 'category' ? 'categories' : 'tags';
  const taxonomy = kind === 'category' ? CATEGORIES : TAGS;
  const facets = new Map<string, { name: string; slug: string }>(taxonomy.map(facet => [normalizeCatalogFacet(facet.slug), facet]));
  for (const facet of catalogFacets(CATALOG_ENTRIES, facetKey)) {
    const slug = normalizeCatalogFacet(facet.slug);
    if (!facets.has(slug)) facets.set(slug, facet);
  }
  const apps = CATALOG_ENTRIES.filter(entry => entry.kind === 'applications');
  return [...facets].map(([slug, facet]) => {
    const category = kind === 'category' ? CATEGORIES.find(item => item.slug === slug) : undefined;
    const parent = CATEGORIES.find(item => item.id === category?.parentId);
    const matches = apps.filter(app => app[facetKey].some(value => normalizeCatalogFacet(value.slug) === slug))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
    const description = kind === 'category'
      ? CATEGORY_DESCRIPTIONS[slug] ?? (parent
        ? `Explore ${facet.name.toLowerCase()} for ${parent.name.toLowerCase()} and find tools for your workflow.`
        : `Explore tools and ideas for ${facet.name.toLowerCase()}.`)
      : TAG_DESCRIPTIONS[slug] ?? `Discover applications and ideas related to ${facet.name.toLowerCase()}.`;
    return {
      slug, name: facet.name, description, parentName: parent?.name,
      rootSlug: CATEGORIES.find(item => item.id === category?.rootId)?.slug ?? category?.slug,
      appCount: matches.length, featuredApps: matches.slice(0, 3),
    };
  }).sort((a, b) => Number(b.appCount > 0) - Number(a.appCount > 0)
    || Number(!!a.parentName) - Number(!!b.parentName) || a.name.localeCompare(b.name));
}

export function searchCatalogDirectory(entries: readonly CatalogDirectoryEntry[], search: string): CatalogDirectoryEntry[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    const text = [entry.name, entry.description, entry.parentName].join(' ').toLowerCase();
    return words.every(word => text.includes(word));
  });
}
