/**
 * usePaginatedData Hook - SmartSignage Pro v2.1
 * Hook para gerenciar dados paginados
 */

import { useState, useMemo } from 'react';

export interface UsePaginatedDataOptions<T> {
  data: T[];
  initialPage?: number;
  initialLimit?: number;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export interface UsePaginatedDataReturn<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  paginatedData: T[];
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function usePaginatedData<T>(
  options: UsePaginatedDataOptions<T>
): UsePaginatedDataReturn<T> {
  const {
    data,
    initialPage = 1,
    initialLimit = 10,
    onPageChange,
    onLimitChange,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);

  const total = data.length;
  const totalPages = Math.ceil(total / limit);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return data.slice(start, end);
  }, [data, page, limit]);

  const setPage = (newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setPageState(validPage);
    onPageChange?.(validPage);
  };

  const setLimit = (newLimit: number) => {
    setLimitState(newLimit);
    setPage(1); // Reset to first page when limit changes
    onLimitChange?.(newLimit);
  };

  const goToFirstPage = () => setPage(1);
  const goToLastPage = () => setPage(totalPages);
  const goToNextPage = () => setPage(page + 1);
  const goToPreviousPage = () => setPage(page - 1);

  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    paginatedData,
    setPage,
    setLimit,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    hasNextPage,
    hasPreviousPage,
  };
}
