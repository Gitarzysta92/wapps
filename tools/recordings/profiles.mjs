// CSS pixels, at the browser's default 16px font size. See README for sources.
export const profiles = {
  phone: { width: 390, height: 844, touch: true, description: 'Narrow cards and bottom navigation' },
  'wide-phone': { width: 640, height: 960, touch: true, description: 'Wider content and two-column suite cards, bottom navigation' },
  tablet: { width: 768, height: 1024, touch: true, description: 'Compact, expandable navigation rails' },
  'tablet-landscape': { width: 1024, height: 768, touch: true, description: 'Landscape tablet, compact navigation rails' },
  laptop: { width: 1152, height: 800, touch: false, description: 'Full sidebars, fluid content column' },
  desktop: { width: 1920, height: 1080, touch: false, description: 'Full sidebars, centered 1280px shell' },
};

export const warmupRoutes = [
  '/discover?search=photo%20editing',
  '/apps/photo-snap/overview',
  '/apps/photo-snap/reviews',
  '/digest',
  '/articles/design-principles-modern-apps',
  '/suites',
  '/suites/creative-tools-suite',
];
