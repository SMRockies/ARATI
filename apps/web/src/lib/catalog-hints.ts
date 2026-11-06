/**
 * The operator-facing map between catalogue inputs and the ARATI_1 storefront.
 * Rendered as the legend on /catalog and reused as per-field hints in the edit
 * row, so the console can always say *which* input changes *which* display.
 */

export type FieldHint = {
  /** Product/DTO field this hint annotates. */
  field: string;
  /** Short label shown next to the input. */
  input: string;
  /** Where the value lands on the public storefront. */
  effect: string;
};

export const FIELD_HINTS: FieldHint[] = [
  { field: 'name', input: 'Product name', effect: 'Card title on /products and the heading of /products/{slug}' },
  { field: 'slug', input: 'Slug', effect: 'The storefront URL — generated once and never changes' },
  { field: 'summary', input: 'Summary', effect: 'One-line blurb under the card title and the detail intro' },
  { field: 'description', input: 'Description', effect: 'Body copy on the product detail page' },
  { field: 'brand', input: 'Brand', effect: 'Brand filter chip and the eyebrow above the card title' },
  { field: 'category', input: 'Category', effect: 'Category filter chip and the breadcrumb on the detail page' },
  { field: 'specifications', input: 'Specifications', effect: 'The “Specifications” table on the detail page' },
  { field: 'imageUrl', input: 'Image URL', effect: 'Main product photo; falls back to an uploaded photo, then a placeholder' },
  { field: 'imageAlt', input: 'Image alt text', effect: 'Alt text of that photo (accessibility/SEO)' },
  {
    field: 'isEnquiryAllowed',
    input: 'Enquiry allowed',
    effect: 'When stock runs out: badge reads “Enquire” instead of “Unavailable”',
  },
  { field: 'publish', input: 'Publish / unpublish', effect: 'Whether the product appears on the storefront at all (refresh ≈ 60 s)' },
  { field: 'lifecycleStatus', input: 'Activate / deactivate', effect: 'Deactivating also unpublishes; hidden products stay in the ERP' },
];

/** Notes about storefront state that has no input here at all. */
export const DERIVED_NOTES: string[] = [
  'Availability badge (In stock / Enquire / Unavailable) — derived from inventory ledger quantities, not typed in here.',
  'Product photos uploaded at the storefront /admin/products screen are used when Image URL is empty.',
  'The storefront caches catalogue responses for ~60 seconds, so a save appears there within a minute.',
];

/** Permission codes this console depends on. */
export const PERMISSIONS = {
  read: 'catalog.read',
  write: 'catalog.write',
  publish: 'catalog.publish',
} as const;
