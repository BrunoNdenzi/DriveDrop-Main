export const STREAMLINE_ICON_SET = 'Ultimate Regular'

export const streamlineIconManifest = [
  // Navigation and layout
  { name: 'dashboard', query: 'dashboard', group: 'navigation' },
  { name: 'menu', query: 'menu navigation', group: 'navigation' },
  { name: 'close', query: 'close', group: 'navigation' },
  { name: 'chevron-down', query: 'chevron down', group: 'navigation' },
  { name: 'chevron-left', query: 'chevron left', group: 'navigation' },
  { name: 'chevron-right', query: 'chevron right', group: 'navigation' },
  { name: 'arrow-left', query: 'arrow left', group: 'navigation' },
  { name: 'arrow-right', query: 'arrow right', group: 'navigation' },
  { name: 'search', query: 'search', group: 'navigation' },
  { name: 'bell', query: 'notification bell', group: 'navigation' },
  { name: 'settings', query: 'settings gear', group: 'navigation' },

  // Accounts and access
  { name: 'user', query: 'user profile', group: 'account' },
  { name: 'users', query: 'multiple users', group: 'account' },
  { name: 'user-approved', query: 'user check approved', group: 'account' },
  { name: 'logout', query: 'logout', group: 'account' },
  { name: 'lock', query: 'lock password', group: 'account' },
  { name: 'key', query: 'key password', group: 'account' },
  { name: 'eye', query: 'eye view', group: 'account' },
  { name: 'eye-hidden', query: 'eye hidden', group: 'account' },
  { name: 'shield', query: 'shield security', group: 'account' },
  { name: 'shield-check', query: 'shield check verified', group: 'account' },

  // Shipments and routing
  { name: 'package', query: 'package box', group: 'logistics' },
  { name: 'package-check', query: 'package check', group: 'logistics' },
  { name: 'truck', query: 'delivery truck', group: 'logistics' },
  { name: 'car', query: 'car', group: 'logistics' },
  { name: 'map', query: 'map', group: 'logistics' },
  { name: 'map-pin', query: 'map pin location', group: 'logistics' },
  { name: 'route', query: 'route navigation', group: 'logistics' },
  { name: 'navigation', query: 'navigation arrow', group: 'logistics' },
  { name: 'calendar', query: 'calendar date', group: 'logistics' },
  { name: 'clock', query: 'clock time', group: 'logistics' },
  { name: 'fuel', query: 'fuel pump', group: 'logistics' },
  { name: 'handshake', query: 'handshake agreement', group: 'logistics' },
  { name: 'clipboard-list', query: 'clipboard list', group: 'logistics' },
  { name: 'clipboard-check', query: 'clipboard check', group: 'logistics' },
  { name: 'building', query: 'office building', group: 'logistics' },

  // Payments and performance
  { name: 'dollar', query: 'dollar currency', group: 'finance' },
  { name: 'price-badge', query: 'price badge dollar', group: 'finance' },
  { name: 'credit-card', query: 'credit card', group: 'finance' },
  { name: 'chart', query: 'bar chart analytics', group: 'finance' },
  { name: 'trend-up', query: 'trend up', group: 'finance' },
  { name: 'trend-down', query: 'trend down', group: 'finance' },
  { name: 'target', query: 'target goal', group: 'finance' },
  { name: 'trophy', query: 'trophy award', group: 'finance' },

  // Communication
  { name: 'mail', query: 'email mail', group: 'communication' },
  { name: 'send', query: 'send message', group: 'communication' },
  { name: 'message', query: 'message chat square', group: 'communication' },
  { name: 'phone', query: 'phone call', group: 'communication' },
  { name: 'paperclip', query: 'paperclip attachment', group: 'communication' },
  { name: 'microphone', query: 'microphone', group: 'communication' },
  { name: 'microphone-off', query: 'microphone off', group: 'communication' },

  // Documents and media
  { name: 'file', query: 'file document', group: 'documents' },
  { name: 'file-text', query: 'file text document', group: 'documents' },
  { name: 'folder', query: 'folder open', group: 'documents' },
  { name: 'upload', query: 'upload', group: 'documents' },
  { name: 'download', query: 'download', group: 'documents' },
  { name: 'camera', query: 'camera', group: 'documents' },
  { name: 'image', query: 'image photo', group: 'documents' },

  // States and actions
  { name: 'check', query: 'check', group: 'actions' },
  { name: 'check-circle', query: 'check circle', group: 'actions' },
  { name: 'alert', query: 'alert warning triangle', group: 'actions' },
  { name: 'error', query: 'error circle', group: 'actions' },
  { name: 'refresh', query: 'refresh', group: 'actions' },
  { name: 'plus', query: 'plus add', group: 'actions' },
  { name: 'trash', query: 'trash delete', group: 'actions' },
  { name: 'save', query: 'save disk', group: 'actions' },
  { name: 'star', query: 'star favorite', group: 'actions' },
  { name: 'filter', query: 'filter', group: 'actions' },

  // Product and administration
  { name: 'bot', query: 'robot bot', group: 'product' },
  { name: 'sparkles', query: 'sparkles magic', group: 'product' },
  { name: 'brain', query: 'brain intelligence', group: 'product' },
  { name: 'lightning', query: 'lightning bolt', group: 'product' },
  { name: 'network', query: 'network nodes', group: 'product' },
  { name: 'plug', query: 'plug integration', group: 'product' },
  { name: 'flask', query: 'laboratory flask', group: 'product' },
  { name: 'briefcase', query: 'briefcase work', group: 'product' },
] as const

export type StreamlineIconName = (typeof streamlineIconManifest)[number]['name']

export const STREAMLINE_ICON_LIMIT = 100

const uniqueIconNames = new Set(streamlineIconManifest.map(icon => icon.name))

if (uniqueIconNames.size !== streamlineIconManifest.length) {
  throw new Error('The Streamline icon manifest contains duplicate names.')
}

if (streamlineIconManifest.length > STREAMLINE_ICON_LIMIT) {
  throw new Error(`The Streamline icon manifest exceeds the ${STREAMLINE_ICON_LIMIT}-icon license limit.`)
}
