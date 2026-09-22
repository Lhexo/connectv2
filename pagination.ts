export type SortOrder = 'asc' | 'desc';

export interface PaginationState {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface TableSortState {
  sortBy: string;
  sortOrder: SortOrder;
}

export interface PaginatedResponse<T, S = Record<string, any>> {
  data: T[];
  pagination: PaginationState;
  sorting: TableSortState;
  summary?: S;
}

export interface UseTablePaginationOptions<F = Record<string, any>> {
  initialPage?: number;
  initialLimit?: number;
  initialSortBy?: string;
  initialSortOrder?: SortOrder;
  initialFilters?: F;
  onParamsChange?: (params: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: SortOrder;
    filters: F;
  }) => void;
}
