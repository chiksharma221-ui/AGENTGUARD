import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export const DataTable = ({
  columns = [],
  data = [],
  isLoading = false,
  onRowClick = null,
  emptyMessage = 'No records found',
  emptyDescription = 'There is currently no data matching your query.',
  itemsPerPage = 10,
  enablePagination = true,
  className = '',
}) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting logic
  const handleSort = (key, sortable) => {
    if (!sortable) return;
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(String(bVal))
          : String(bVal).localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortKey, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    if (!enablePagination) return sortedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, enablePagination]);

  return (
    <div className={`w-full overflow-hidden rounded-xl border border-white/5 bg-surface-900/60 backdrop-blur-md ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-surface-850/80 text-xs uppercase tracking-wider text-slate-400 border-b border-surface-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key || col.label}
                  scope="col"
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key, col.sortable)}
                  className={`px-6 py-3.5 font-medium ${
                    col.sortable ? 'cursor-pointer select-none hover:text-white transition-colors' : ''
                  } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end w-full' : ''}`}>
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="text-slate-500">
                        {sortKey === col.key ? (
                          sortOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-primary-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-primary-400" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-800/60 font-sans">
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: itemsPerPage > 5 ? 5 : itemsPerPage }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-cell-${cIdx}`} className="px-6 py-4">
                      <div className="h-4 bg-surface-800 rounded skeleton w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-3 bg-surface-800/60 rounded-full border border-surface-700/50 text-slate-500 mb-3">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <p className="text-base font-medium text-slate-200">{emptyMessage}</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={row.id || row._id || `row-${rowIdx}`}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors duration-150 ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-800/60' : 'hover:bg-surface-800/30'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key || col.label}
                      className={`px-6 py-4 text-slate-300 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {enablePagination && !isLoading && sortedData.length > 0 && (
        <div className="px-6 py-3.5 bg-surface-900/80 border-t border-surface-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-200">
              {Math.min((currentPage - 1) * itemsPerPage + 1, sortedData.length)}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-200">
              {Math.min(currentPage * itemsPerPage, sortedData.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-200">{sortedData.length}</span> results
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-surface-700 bg-surface-800 hover:bg-surface-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-surface-700 bg-surface-800 hover:bg-surface-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
