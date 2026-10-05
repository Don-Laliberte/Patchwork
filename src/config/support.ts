/**
 * Donation / support destinations.
 * Point the app at /support only in UI copy; change providers here anytime.
 */
export const SUPPORT_LINKS = [
  {
    id: 'primary',
    label: 'Support Patchwork',
    href: 'https://ko-fi.com/W5Y1289CMI',
    description: 'If Patchwork helped your elimination log, you can support development here.',
  },
] as const

export const PRODUCT_URL_WORKER_PATH = '/api/fetch-product-url'
