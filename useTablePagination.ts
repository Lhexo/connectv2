import { useState, useCallback, useMemo } from 'react';
import { SortOrder, PaginationState, UseTablePaginationOptions } from '../types/pagination';

export function useTablePagination<F extends Record<string, any> = Record<string, any>>(
  options: UseTablePaginationOptions<F> = {}
) {
  const {
    initialPage = 1,
    initialLimit = 25,
    initialSortBy = 'date',
    initialSortOrder = 'desc',
    initialFilters = {} as F,
    onParamsChange,
  } = options;

  const [page, setPageState] = useState<number>(initialPage);
  const [limit, setLimitState] = useState<number>(initialLimit);
  const [sortBy, setSortByState] = useState<string>(initialSortBy);
  const [sortOrder, setSortOrderState] = useState<SortOrder>(initialSortOrder);
  const [filters, setFiltersState] = useState<F>(initialFilters);

  const [paginationData, setPaginationData] = useState<PaginationState>({
    page: initialPage,
    limit: initialLimit,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const notifyChange = useCallback(
    (nextPage: number, nextLimit: number, nextSortBy: string, nextSortOrder: SortOrder, nextFilters: F) => {
      if (onParamsChange) {
        onParamsChange({
          page: nextPage,
          limit: nextLimit,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
          filters: nextFilters,
        });
      }
    },
    [onParamsChange]
  );

  const setPage = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, newPage);
      setPageState(validPage);
      notifyChange(validPage, limit, sortBy, sortOrder, filters);
    },
    [limit, sortBy, sortOrder, filters, notifyChange]
  );

  const setLimit = useCallback(
    (newLimit: number) => {
      const validLimit = Math.max(1, newLimit);
      setLimitState(validLimit);
      setPageState(1);
      notifyChange(1, validLimit, sortBy, sortOrder, filters);
    },
    [sortBy, sortOrder, filters, notifyChange]
  );

  const toggleSort = useCallback(
    (columnKey: string) => {
      let nextOrder: SortOrder = 'asc';
      if (sortBy === columnKey) {
        nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      }
      setSortByState(columnKey);
      setSortOrderState(nextOrder);
      // Preserves active page and active filters
      notifyChange(page, limit, columnKey, nextOrder, filters);
    },
    [sortBy, sortOrder, page, limit, filters, notifyChange]
  );

  const setSort = useCallback(
    (columnKey: string, order: SortOrder) => {
      setSortByState(columnKey);
      setSortOrderState(order);
      notifyChange(page, limit, columnKey, order, filters);
    },
    [page, limit, filters, notifyChange]
  );

  const setFilter = useCallback(
    <K extends keyof F>(key: K, value: F[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value };
        // Reset to page 1 on filter change to ensure valid range, while preserving sorting
        setPageState(1);
        notifyChange(1, limit, sortBy, sortOrder, next);
        return next;
      });
    },
    [limit, sortBy, sortOrder, notifyChange]
  );

  const setFilters = useCallback(
    (updater: Partial<F> | ((prev: F) => F)) => {
      setFiltersState((prev) => {
        const next = typeof updater === 'function' ? (updater as (prev: F) => F)(prev) : { ...prev, ...updater };
        setPageState(1);
        notifyChange(1, limit, sortBy, sortOrder, next);
        return next;
      });
    },
    [limit, sortBy, sortOrder, notifyChange]
  );

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setPageState(1);
    notifyChange(1, limit, sortBy, sortOrder, initialFilters);
  }, [initialFilters, limit, sortBy, sortOrder, notifyChange]);

  const updatePagination = useCallback((meta: Partial<PaginationState>) => {
    setPaginationData((prev) => ({
      ...prev,
      ...meta,
    }));
  }, []);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    };

    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'all' && val !== 'ALL') {
        params[key] = String(val);
      }
    });

    return params;
  }, [page, limit, sortBy, sortOrder, filters]);

  const queryString = useMemo(() => {
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => searchParams.set(k, v));
    return searchParams.toString();
  }, [queryParams]);

  const startIndex = useMemo(() => {
    if (paginationData.totalItems === 0) return 0;
    return (page - 1) * limit + 1;
  }, [page, limit, paginationData.totalItems]);

  const endIndex = useMemo(() => {
    return Math.min(page * limit, paginationData.totalItems);
  }, [page, limit, paginationData.totalItems]);

  const sortState = useMemo(() => ({
    sortBy,
    sortOrder,
  }), [sortBy, sortOrder]);

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    sortState,
    filters,
    pagination: paginationData,
    startIndex,
    endIndex,
    queryParams,
    queryString,
    setPage,
    setLimit,
    toggleSort,
    setSort,
    setFilter,
    setFilters,
    resetFilters,
    updatePagination,
  };
}
