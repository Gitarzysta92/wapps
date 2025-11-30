export type ArticleDto = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  author: string;
  category: string;
  coverImageUrl: { url: string; alt: string };
  publishedDate: Date;
  updatedDate?: Date;
  tags?: string[];
};

