import { ArticleDto } from '@domains/publication/article';

export const SAMPLE_ARTICLE: ArticleDto = {
  id: 'article-1',
  slug: 'getting-started-with-productivity-apps',
  title: 'Getting Started with Productivity Apps in 2024',
  excerpt: 'Discover the best productivity apps that can help you streamline your workflow and boost your efficiency. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  author: 'John Doe',
  category: 'Productivity',
  coverImageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
  publishedDate: new Date('2024-01-15'),
  updatedDate: new Date('2024-01-20'),
  tags: ['productivity', 'apps', 'workflow']
};

export const TECH_ARTICLE: ArticleDto = {
  id: 'article-2',
  slug: 'tech-trends-2024',
  title: 'Top Tech Trends to Watch in 2024',
  excerpt: 'Explore the cutting-edge technologies shaping the future of software development and digital innovation. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  author: 'Jane Smith',
  category: 'Technology',
  coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  publishedDate: new Date('2024-02-01'),
  tags: ['technology', 'innovation', 'trends']
};

export const DESIGN_ARTICLE: ArticleDto = {
  id: 'article-3',
  slug: 'design-principles-modern-apps',
  title: 'Design Principles for Modern Applications',
  excerpt: 'Learn essential design principles that can help you create beautiful and user-friendly applications. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  author: 'Mike Johnson',
  category: 'Design',
  coverImageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
  publishedDate: new Date('2024-02-10'),
  tags: ['design', 'ui', 'ux']
};

export const ARTICLES: ArticleDto[] = [
  SAMPLE_ARTICLE,
  TECH_ARTICLE,
  DESIGN_ARTICLE
];

