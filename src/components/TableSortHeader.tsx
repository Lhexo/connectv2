import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { SortOrder } from '../types/pagination';
import { cn } from '../lib/utils';

export interface TableSortHeaderProps {
  columnKey: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  currentSortBy?: string;
  currentSortOrder?: SortOrder;
  sortState?: { sortBy: string; sortOrder: SortOrder };
  onSort: (columnKey: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

export const TableSortHeader: React.FC<TableSortHeaderProps> = ({
  columnKey,
  label,
  children,
  currentSortBy,
  currentSortOrder,
  sortState,
  onSort,
  align = 'left',
  className = '',
  title,
}) => {
  const activeSortBy = currentSortBy ?? sortState?.sortBy ?? '';
  const activeSortOrder = currentSortOrder ?? sortState?.sortOrder ?? 'asc';
  const displayLabel = label ?? children;
  const isSorted = activeSortBy === columnKey;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSort(columnKey);
  };

  const getAriaSort = () => {
    if (!isSorted) return 'none';
    return activeSortOrder === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <th
      scope="col"
      aria-sort={getAriaSort()}
      className={cn(
        'py-3 px-4 text-[10px] font-black uppercase tracking-widest transition-colors select-none',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        title={
          title ||
          (isSorted
            ? `Ordinato per ${typeof displayLabel === 'string' ? displayLabel : columnKey} (${activeSortOrder === 'asc' ? 'Crescente' : 'Decrescente'}). Clicca per invertire.`
            : `Clicca per ordinare per ${typeof displayLabel === 'string' ? displayLabel : columnKey}`)
        }
        className={cn(
          'group inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A5A40]/40 rounded py-0.5 px-1 -mx-1 transition-all cursor-pointer',
          align === 'right' ? 'ml-auto justify-end' : align === 'center' ? 'mx-auto justify-center' : 'justify-start',
          isSorted ? 'text-[#111827] font-black' : 'text-[#6B7280] hover:text-[#111827]'
        )}
      >
        <span>{displayLabel}</span>
        <span
          className={cn(
            'inline-flex items-center justify-center p-0.5 rounded transition-colors',
            isSorted
              ? 'text-[#5A5A40] bg-[#5A5A40]/10'
              : 'text-gray-300 group-hover:text-gray-500'
          )}
        >
          {isSorted ? (
            activeSortOrder === 'asc' ? (
              <ArrowUp size={12} className="stroke-[2.5]" />
            ) : (
              <ArrowDown size={12} className="stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown size={12} className="stroke-[1.75]" />
          )}
        </span>
      </button>
    </th>
  );
};
