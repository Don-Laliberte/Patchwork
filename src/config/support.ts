/**
 * Donation / support destinations.
 * Point the app at /support only in UI copy; change providers here anytime.
 */
export const SUPPORT_LINKS = [
  {
    id: 'primary',
    label: 'Support Patchwork',
    href: 'https://ko-fi.com/W5Y1289CMI',
  },
] as const

/** Opens a new GitHub issue for bug reports. */
export const BUG_REPORT = {
  label: 'Report a bug',
  href: 'https://github.com/Don-Laliberte/Patchwork/issues/new',
} as const

export const PRODUCT_URL_WORKER_PATH = '/api/fetch-product-url'
