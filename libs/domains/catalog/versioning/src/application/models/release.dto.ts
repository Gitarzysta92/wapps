export type ReleaseDto = {
  id: string;
  appId: string;
  version: string;
  releaseDate: Date;
  releaseType: 'major' | 'minor' | 'patch';
  status: 'draft' | 'published' | 'archived';
  title?: string;
  description: string;
  changes: ChangelogEntryDto[];
  metadata?: {
    downloads?: number;
    criticalUpdate?: boolean;
  };
};

export type ChangelogEntryDto = {
  id: string;
  category: 'feature' | 'fix' | 'improvement' | 'breaking';
  description: string;
  ticketId?: string;
};
