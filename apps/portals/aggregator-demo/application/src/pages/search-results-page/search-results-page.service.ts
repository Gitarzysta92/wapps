import { Injectable } from '@angular/core';
import { MultiSearchResultVM } from '@portals/shared/features/multi-search';
import { 
  DiscoverySearchResultType, 
  DiscoverySearchResultApplicationItemDto,
  DiscoverySearchResultArticleItemDto,
  DiscoverySearchResultSuiteItemDto 
} from '@domains/discovery';

interface PageData {
  pageNumber: number;
  data: MultiSearchResultVM;
}

@Injectable()
export class SearchResultsPageService {
  // Track loaded pages with their data
  private loadedPages = new Map<number, MultiSearchResultVM>();
  private firstLoadedPage = 1;
  private lastLoadedPage = 1;
  private totalPages = 5;
  private itemsPerPage = 9; // 3 groups with 3 items each

  constructor() {
    // Load initial page
    this.loadPage(1);
  }

  // Get all items from loaded pages in order
  public get allLoadedItems(): PageData[] {
    const pages: PageData[] = [];
    for (let i = this.firstLoadedPage; i <= this.lastLoadedPage; i++) {
      const data = this.loadedPages.get(i);
      if (data) {
        pages.push({ pageNumber: i, data });
      }
    }
    return pages;
  }

  public get canLoadPrevious(): boolean {
    return this.firstLoadedPage > 1;
  }

  public get canLoadNext(): boolean {
    return this.lastLoadedPage < this.totalPages;
  }

  public get totalLoadedItems(): number {
    let count = 0;
    this.loadedPages.forEach(data => count += data.itemsNumber);
    return count;
  }

  public loadPreviousPage(): void {
    if (this.canLoadPrevious) {
      const pageToLoad = this.firstLoadedPage - 1;
      this.loadPage(pageToLoad);
      this.firstLoadedPage = pageToLoad;
    }
  }

  public loadNextPage(): void {
    if (this.canLoadNext) {
      const pageToLoad = this.lastLoadedPage + 1;
      this.loadPage(pageToLoad);
      this.lastLoadedPage = pageToLoad;
    }
  }

  private loadPage(pageNumber: number): void {
    // Mock API call - generate discovery search results for this page
    const data = this.generateMockSearchResults(pageNumber);
    this.loadedPages.set(pageNumber, data);
  }

  private generateMockSearchResults(page: number): MultiSearchResultVM {
    const baseId = (page - 1) * this.itemsPerPage;
    
    const categories = [
      { slug: 'photo-editing', name: 'Photo Editing' },
      { slug: 'project-management', name: 'Project Management' },
      { slug: 'vpn-client', name: 'VPN Client' },
      { slug: 'budgeting-apps', name: 'Budgeting Apps' },
      { slug: 'meditation-apps', name: 'Meditation Apps' },
      { slug: 'activity-tracking', name: 'Activity Tracking' },
      { slug: 'ecommerce-platforms', name: 'E-commerce Platforms' },
      { slug: 'communication', name: 'Communication' }
    ];

    const tags = [
      { slug: 'productivity', name: 'Productivity' },
      { slug: 'web-development', name: 'Web Development' },
      { slug: 'mobile-development', name: 'Mobile Development' },
      { slug: 'finance', name: 'Finance' },
      { slug: 'health', name: 'Health' },
      { slug: 'security', name: 'Security' }
    ];

    // Generate suites
    const suites: DiscoverySearchResultSuiteItemDto[] = [];
    for (let i = 0; i < 1; i++) {
      const id = baseId + i + 1;
      suites.push({
        type: DiscoverySearchResultType.Suite,
        name: `Productivity Suite ${id}`,
        slug: `productivity-suite-${id}`,
        coverImageUrl: `https://images.unsplash.com/photo-${1600000000000 + id * 10000}?w=800`,
        numberOfApps: 5 + (id % 8),
        commentsNumber: 50 + (id % 100),
        authorName: `Suite Author ${id % 5 + 1}`,
        authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
        tags: [tags[id % tags.length], tags[(id + 1) % tags.length]]
      });
    }

    // Generate applications
    const applications: DiscoverySearchResultApplicationItemDto[] = [];
    for (let i = 0; i < 5; i++) {
      const id = baseId + i + 1;
      applications.push({
        type: DiscoverySearchResultType.Application,
        name: `App ${id}`,
        slug: `app-${id}`,
        coverImageUrl: `https://images.unsplash.com/photo-${1600000000000 + id * 20000}?w=800`,
        rating: 3.5 + Math.random() * 1.5,
        commentsNumber: 10 + (id % 50),
        category: categories[id % categories.length],
        tags: [tags[id % tags.length], tags[(id + 2) % tags.length]]
      });
    }

    // Generate articles
    const articles: DiscoverySearchResultArticleItemDto[] = [];
    for (let i = 0; i < 3; i++) {
      const id = baseId + i + 1;
      articles.push({
        type: DiscoverySearchResultType.Article,
        name: `Article ${id}: Understanding Modern Technology`,
        title: `Article ${id}: Understanding Modern Technology`,
        slug: `article-${id}`,
        coverImageUrl: `https://images.unsplash.com/photo-${1600000000000 + id * 30000}?w=800`,
        commentsNumber: 20 + (id % 80),
        authorName: `Author ${id % 10 + 1}`,
        authorAvatarUrl: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
        tags: [tags[id % tags.length], tags[(id + 3) % tags.length]]
      });
    }

    return {
      query: { search: 'productivity', page: page.toString() },
      itemsNumber: suites.length + applications.length + articles.length,
      link: `/search?query=productivity&page=${page}`,
      groups: [
        {
          type: DiscoverySearchResultType.Suite,
          entries: suites.map(suite => ({ ...suite, link: `/suites/${suite.slug}` })),
          link: '/suites'
        },
        {
          type: DiscoverySearchResultType.Application,
          entries: applications.map(app => ({ ...app, link: `/apps/${app.slug}` })),
          link: '/apps'
        },
        {
          type: DiscoverySearchResultType.Article,
          entries: articles.map(article => ({ ...article, link: `/articles/${article.slug}` })),
          link: '/articles'
        }
      ]
    };
  }

  public reset(): void {
    this.loadedPages.clear();
    this.firstLoadedPage = 1;
    this.lastLoadedPage = 1;
    this.loadPage(1);
  }
}

