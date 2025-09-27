// Smart Search Types
export interface SmartSearchQuery {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface SmartSearchResult {
  id: string;
  title: string;
  description?: string;
  score: number;
  type: string;
}

export interface SmartSearchResponse {
  results: SmartSearchResult[];
  total: number;
  query: string;
}
