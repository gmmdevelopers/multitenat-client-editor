export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface SearchQuery extends PaginationQuery {
  q?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}
