import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { PaginationState } from '../types/pagination';
import { cn } from '../lib/utils';

export interface DataTablePaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  itemName?: string;
  className?: string;
  isLoading?: boolean;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  pagination,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel,
  itemName,
  className = '',
  isLoading = false,
}) => {
  const effectiveItemLabel = itemLabel ?? itemName ?? 'elementi';
  const { page, limit, totalItems, totalPages } = pagination;
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  const startIndex = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, totalItems);

  // Generate visible page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 1) {
      return [1];
    }
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];
    pages.push(1);

    const startPage = Math.max(2, page - 1);
    const endPage = Math.min(totalPages - 1, page + 1);

    if (startPage > 2) {
      pages.push('ellipsis');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = parseInt(jumpPageInput, 10);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      onPageChange(targetPage);
      setJumpPageInput('');
    }
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 py-3.5 px-4 bg-white border-t border-gray-150 text-xs select-none transition-opacity',
        isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100',
        className
      )}
    >
      {/* Left side: Rows count & page size */}
      <div className="flex items-center gap-4 flex-wrap text-gray-600">
        <div>
          Mostrati <span className="font-mono font-bold text-gray-900">{startIndex}</span>
          {' - '}
          <span className="font-mono font-bold text-gray-900">{endIndex}</span>
          {' di '}
          <span className="font-mono font-bold text-[#5A5A40]">{totalItems}</span> {effectiveItemLabel}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span>Per pagina:</span>
          <select
            value={limit ?? 25}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Numero di righe per pagina"
            className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right side: Navigation buttons */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || totalItems === 0}
          title="Prima pagina"
          aria-label="Prima pagina"
          className={cn(
            'p-1.5 rounded-lg border transition-all cursor-pointer',
            page <= 1 || totalItems === 0
              ? 'border-gray-100 text-gray-300 bg-gray-50/50 cursor-not-allowed'
              : 'border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95'
          )}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || totalItems === 0}
          title="Pagina precedente"
          aria-label="Pagina precedente"
          className={cn(
            'p-1.5 rounded-lg border transition-all cursor-pointer',
            page <= 1 || totalItems === 0
              ? 'border-gray-100 text-gray-300 bg-gray-50/50 cursor-not-allowed'
              : 'border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95'
          )}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Numeric Page Pills */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-gray-400 font-mono text-xs select-none">
                  •••
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                disabled={totalItems === 0}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer',
                  isCurrent
                    ? 'bg-[#5A5A40] text-white shadow-2xs'
                    : 'text-gray-700 hover:bg-gray-100 active:scale-95 border border-transparent hover:border-gray-200',
                  totalItems === 0 && 'opacity-60 cursor-not-allowed'
                )}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || totalItems === 0}
          title="Pagina successiva"
          aria-label="Pagina successiva"
          className={cn(
            'p-1.5 rounded-lg border transition-all cursor-pointer',
            page >= totalPages || totalItems === 0
              ? 'border-gray-100 text-gray-300 bg-gray-50/50 cursor-not-allowed'
              : 'border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95'
          )}
        >
          <ChevronRight size={16} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || totalItems === 0}
          title="Ultima pagina"
          aria-label="Ultima pagina"
          className={cn(
            'p-1.5 rounded-lg border transition-all cursor-pointer',
            page >= totalPages || totalItems === 0
              ? 'border-gray-100 text-gray-300 bg-gray-50/50 cursor-not-allowed'
              : 'border-gray-200 text-gray-700 hover:bg-gray-100 active:scale-95'
          )}
        >
          <ChevronsRight size={16} />
        </button>

        {/* Fast Jump input if > 5 pages */}
        {totalPages > 5 && (
          <form onSubmit={handleJumpSubmit} className="hidden md:flex items-center gap-1 ml-2 pl-2 border-l border-gray-200">
            <span className="text-[11px] text-gray-400">Vai a:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(page)}
              className="w-12 text-center text-xs font-mono font-bold bg-gray-50 border border-gray-200 rounded-md py-1 px-1 text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
            <button
              type="submit"
              disabled={!jumpPageInput}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded text-gray-700 cursor-pointer"
            >
              Vai
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
