import type { LucideIcon, LucideProps } from 'lucide-react'

import { StreamlineIcon } from './StreamlineIcon'
import type { StreamlineIconName } from './streamline-manifest'

export * from 'lucide-react'

function createStreamlineIcon(name: StreamlineIconName, displayName: string): LucideIcon {
  const Icon = ({ size = 24, className, 'aria-label': label }: LucideProps) => (
    <StreamlineIcon
      className={className}
      label={typeof label === 'string' ? label : undefined}
      name={name}
      size={typeof size === 'number' ? size : Number.parseFloat(size) || 24}
    />
  )

  Icon.displayName = displayName
  return Icon as LucideIcon
}

export const LayoutDashboard = createStreamlineIcon('dashboard', 'LayoutDashboard')
export const Menu = createStreamlineIcon('menu', 'Menu')
export const X = createStreamlineIcon('close', 'X')
export const ChevronDown = createStreamlineIcon('chevron-down', 'ChevronDown')
export const ChevronLeft = createStreamlineIcon('chevron-left', 'ChevronLeft')
export const ChevronRight = createStreamlineIcon('chevron-right', 'ChevronRight')
export const ArrowLeft = createStreamlineIcon('arrow-left', 'ArrowLeft')
export const ArrowRight = createStreamlineIcon('arrow-right', 'ArrowRight')
export const Search = createStreamlineIcon('search', 'Search')
export const Bell = createStreamlineIcon('bell', 'Bell')
export const Settings = createStreamlineIcon('settings', 'Settings')

export const User = createStreamlineIcon('user', 'User')
export const Users = createStreamlineIcon('users', 'Users')
export const UserCheck = createStreamlineIcon('user-approved', 'UserCheck')
export const LogOut = createStreamlineIcon('logout', 'LogOut')
export const Lock = createStreamlineIcon('lock', 'Lock')
export const LockKeyhole = createStreamlineIcon('lock', 'LockKeyhole')
export const Key = createStreamlineIcon('key', 'Key')
export const KeyRound = createStreamlineIcon('key', 'KeyRound')
export const Eye = createStreamlineIcon('eye', 'Eye')
export const EyeOff = createStreamlineIcon('eye-hidden', 'EyeOff')
export const Shield = createStreamlineIcon('shield', 'Shield')
export const ShieldCheck = createStreamlineIcon('shield-check', 'ShieldCheck')

export const Package = createStreamlineIcon('package', 'Package')
export const PackageCheck = createStreamlineIcon('package-check', 'PackageCheck')
export const Truck = createStreamlineIcon('truck', 'Truck')
export const Car = createStreamlineIcon('car', 'Car')
export const Map = createStreamlineIcon('map', 'Map')
export const MapPin = createStreamlineIcon('map-pin', 'MapPin')
export const Route = createStreamlineIcon('route', 'Route')
export const Navigation = createStreamlineIcon('navigation', 'Navigation')
export const Calendar = createStreamlineIcon('calendar', 'Calendar')
export const Clock = createStreamlineIcon('clock', 'Clock')
export const Clock3 = createStreamlineIcon('clock', 'Clock3')
export const Fuel = createStreamlineIcon('fuel', 'Fuel')
export const Handshake = createStreamlineIcon('handshake', 'Handshake')
export const ClipboardList = createStreamlineIcon('clipboard-list', 'ClipboardList')
export const ClipboardCheck = createStreamlineIcon('clipboard-check', 'ClipboardCheck')
export const Building = createStreamlineIcon('building', 'Building')
export const Building2 = createStreamlineIcon('building', 'Building2')

export const DollarSign = createStreamlineIcon('dollar', 'DollarSign')
export const BadgeDollarSign = createStreamlineIcon('price-badge', 'BadgeDollarSign')
export const CreditCard = createStreamlineIcon('credit-card', 'CreditCard')
export const BarChart = createStreamlineIcon('chart', 'BarChart')
export const BarChart3 = createStreamlineIcon('chart', 'BarChart3')
export const TrendingUp = createStreamlineIcon('trend-up', 'TrendingUp')
export const TrendingDown = createStreamlineIcon('trend-down', 'TrendingDown')
export const Target = createStreamlineIcon('target', 'Target')
export const Trophy = createStreamlineIcon('trophy', 'Trophy')

export const Mail = createStreamlineIcon('mail', 'Mail')
export const Send = createStreamlineIcon('send', 'Send')
export const MessageSquare = createStreamlineIcon('message', 'MessageSquare')
export const MessageCircle = createStreamlineIcon('message', 'MessageCircle')
export const Phone = createStreamlineIcon('phone', 'Phone')
export const Paperclip = createStreamlineIcon('paperclip', 'Paperclip')
export const Mic = createStreamlineIcon('microphone', 'Mic')
export const MicOff = createStreamlineIcon('microphone-off', 'MicOff')

export const File = createStreamlineIcon('file', 'File')
export const FileText = createStreamlineIcon('file-text', 'FileText')
export const Folder = createStreamlineIcon('folder', 'Folder')
export const FolderOpen = createStreamlineIcon('folder', 'FolderOpen')
export const Upload = createStreamlineIcon('upload', 'Upload')
export const Download = createStreamlineIcon('download', 'Download')
export const Camera = createStreamlineIcon('camera', 'Camera')
export const Image = createStreamlineIcon('image', 'Image')
export const ImagePlus = createStreamlineIcon('image', 'ImagePlus')

export const Check = createStreamlineIcon('check', 'Check')
export const CheckCircle = createStreamlineIcon('check-circle', 'CheckCircle')
export const CheckCircle2 = createStreamlineIcon('check-circle', 'CheckCircle2')
export const AlertTriangle = createStreamlineIcon('alert', 'AlertTriangle')
export const AlertCircle = createStreamlineIcon('error', 'AlertCircle')
export const XCircle = createStreamlineIcon('error', 'XCircle')
export const RefreshCw = createStreamlineIcon('refresh', 'RefreshCw')
export const Plus = createStreamlineIcon('plus', 'Plus')
export const Trash2 = createStreamlineIcon('trash', 'Trash2')
export const Save = createStreamlineIcon('save', 'Save')
export const Star = createStreamlineIcon('star', 'Star')
export const Filter = createStreamlineIcon('filter', 'Filter')

export const Bot = createStreamlineIcon('bot', 'Bot')
export const Sparkles = createStreamlineIcon('sparkles', 'Sparkles')
export const Brain = createStreamlineIcon('brain', 'Brain')
export const Zap = createStreamlineIcon('lightning', 'Zap')
export const Network = createStreamlineIcon('network', 'Network')
export const Plug = createStreamlineIcon('plug', 'Plug')
export const FlaskConical = createStreamlineIcon('flask', 'FlaskConical')
export const Briefcase = createStreamlineIcon('briefcase', 'Briefcase')