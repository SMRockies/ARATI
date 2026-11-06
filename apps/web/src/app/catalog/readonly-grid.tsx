'use client';

import { DataGrid, type GridColumn } from '../../components/data-grid';
import type { Product } from '../../lib/api';

/**
 * Catalogue grid — product columns over the shared `DataGrid`.
 * Renders from data already loaded by the catalog page; it never writes.
 */

const COLUMNS: GridColumn<Product>[] = [
  { key: 'code', label: 'Code', cell: (product) => ({ text: product.code, mono: true }) },
  { key: 'name', label: 'Product', cell: (product) => ({ text: product.name }) },
  { key: 'brand', label: 'Brand', cell: (product) => ({ text: product.brand?.name ?? '—' }) },
  { key: 'category', label: 'Category', cell: (product) => ({ text: product.category?.name ?? '—' }) },
  {
    key: 'lifecycleStatus',
    label: 'State',
    cell: (product) => ({
      text: product.lifecycleStatus,
      badge: product.lifecycleStatus === 'ACTIVE' ? 'badge badge-green' : 'badge badge-grey',
    }),
  },
  {
    key: 'isPublished',
    label: 'Storefront',
    cell: (product) => ({
      text: product.isPublished ? 'Published' : 'Not published',
      sortValue: product.isPublished ? 1 : 0,
      badge: product.isPublished ? 'badge badge-blue' : 'badge badge-grey',
    }),
  },
];

/** Availability is supplied by the page (market projection), not stored on Product. */
type Row = Product & { availability: string };

function badgeForAvailability(text: string): string | null {
  if (text === 'IN_STOCK') return 'badge badge-green';
  if (text === 'ENQUIRE') return 'badge badge-amber';
  if (text === 'UNAVAILABLE') return 'badge badge-grey';
  return null;
}

export function ReadOnlyGrid({
  products,
  availabilityBySlug,
  onSelect,
}: {
  products: Product[];
  availabilityBySlug: Record<string, string>;
  onSelect: (product: Product) => void;
}) {
  const rows: Row[] = products.map((product) => ({
    ...product,
    availability: availabilityBySlug[product.slug] ?? '—',
  }));

  // Product columns are Row-safe (availability is additive), so the cast is safe.
  const columns: GridColumn<Row>[] = [
    ...(COLUMNS as unknown as GridColumn<Row>[]),
    {
      key: 'availability',
      label: 'Availability',
      cell: (row) => ({ text: row.availability, badge: badgeForAvailability(row.availability) }),
    },
  ];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      searchText={(row) =>
        [row.code, row.name, row.brand?.name ?? '', row.category?.name ?? ''].join(' ')
      }
      onRowActivate={onSelect}
      filterLabel="Filter products"
      filterPlaceholder="Code, product, brand or category…"
      emptyMessage="No products yet."
      filteredMessage="No products match that filter."
    />
  );
}
