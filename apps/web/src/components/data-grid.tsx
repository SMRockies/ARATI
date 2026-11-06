'use client';

import { useMemo, useState } from 'react';

/**
 * Shared read-only grid: filter, sort, choose columns, activate a row.
 *
 * Deliberately dumb — it renders rows it is given and never fetches or writes.
 * Column definitions own all knowledge of the row shape, so catalogue and
 * inventory can share one implementation without sharing a model.
 */

export type GridCell = {
  text: string;
  /** Sort key when alphabetical order is wrong (quantities, dates). */
  sortValue?: number | string;
  /** Existing badge class, e.g. `badge badge-green`. */
  badge?: string | null;
  href?: string | null;
  mono?: boolean;
};

export type GridColumn<T> = {
  key: string;
  label: string;
  numeric?: boolean;
  cell: (row: T) => GridCell;
};

export function DataGrid<T>({
  rows,
  columns,
  rowKey,
  searchText,
  onRowActivate,
  filterLabel = 'Filter',
  filterPlaceholder = 'Search…',
  emptyMessage = 'Nothing to show yet.',
  filteredMessage = 'Nothing matches that filter.',
}: {
  rows: T[];
  columns: GridColumn<T>[];
  rowKey: (row: T) => string;
  searchText: (row: T) => string;
  onRowActivate?: (row: T) => void;
  filterLabel?: string;
  filterPlaceholder?: string;
  emptyMessage?: string;
  filteredMessage?: string;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [ascending, setAscending] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(column.key));

  const ordered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) => searchText(row).toLowerCase().includes(needle))
      : rows;

    if (!sortKey) return filtered;
    const column = columns.find((entry) => entry.key === sortKey);
    if (!column) return filtered;

    const valueOf = (row: T) => {
      const cell = column.cell(row);
      return cell.sortValue ?? cell.text;
    };

    return [...filtered].sort((left, right) => {
      const a = valueOf(left);
      const b = valueOf(right);
      const result =
        typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
      return ascending ? result : -result;
    });
  }, [rows, columns, query, searchText, sortKey, ascending]);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setAscending((current) => !current);
      return;
    }
    setSortKey(key);
    setAscending(true);
  }

  function toggleColumn(key: string) {
    setHiddenColumns((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  }

  const activate = onRowActivate
    ? (row: T) => ({
        tabIndex: 0,
        role: 'button' as const,
        onClick: () => onRowActivate(row),
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRowActivate(row);
          }
        },
      })
    : () => ({});

  return (
    <div className="grid-view">
      <div className="grid-toolbar">
        <label className="grid-search">
          <span className="field-hint">{filterLabel}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={filterPlaceholder}
            aria-label={filterLabel}
          />
        </label>
        <div className="grid-columns" role="group" aria-label="Columns">
          <span className="field-hint">Columns</span>
          {columns.map((column) => {
            const shown = !hiddenColumns.includes(column.key);
            return (
              <button
                key={column.key}
                type="button"
                className={shown ? 'text-button grid-column-on' : 'text-button grid-column-off'}
                aria-pressed={shown}
                onClick={() => toggleColumn(column.key)}
              >
                {column.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key} className={column.numeric ? 'grid-num' : undefined}>
                  <button type="button" className="text-button" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    {sortKey === column.key ? (ascending ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={rowKey(row)} className={onRowActivate ? 'grid-row' : undefined} {...activate(row)}>
                {visibleColumns.map((column) => {
                  const cell = column.cell(row);
                  return (
                    <td
                      key={column.key}
                      className={[column.numeric ? 'grid-num' : '', cell.mono ? 'mono' : ''].join(' ').trim() || undefined}
                    >
                      {cell.href ? (
                        <a href={cell.href} target="_blank" rel="noreferrer" className="storefront-link">
                          {cell.text}
                        </a>
                      ) : cell.badge ? (
                        <span className={cell.badge}>{cell.text}</span>
                      ) : cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
            {ordered.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan={visibleColumns.length}>
                  {rows.length === 0 ? emptyMessage : filteredMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
