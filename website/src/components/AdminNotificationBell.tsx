'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, Check, CheckCheck, X,
  Package, CreditCard, UserCheck, Mail,
  AlertTriangle, Trash2, ShieldAlert, MessageCircle,
} from 'lucide-react'
import { useAdminNotifications, type AdminNotification } from '@/hooks/useAdminNotifications'
import { formatDistanceToNow } from 'date-fns'

// ---- Maps ----

const typeIcons: Record<string, typeof Bell> = {
  new_shipment: Package,
  driver_application: UserCheck,
  payment_failed: CreditCard,
  support_ticket: MessageCircle,
  deletion_request: Trash2,
  email_failure: Mail,
  assignment_update: Check,
  dispute: ShieldAlert,
  system: Bell,
}

const typeColors: Record<string, string> = {
  new_shipment: 'bg-purple-50 text-purple-600',
  driver_application: 'bg-blue-50 text-blue-600',
  payment_failed: 'bg-red-50 text-red-600',
  support_ticket: 'bg-cyan-50 text-cyan-600',
  deletion_request: 'bg-orange-50 text-orange-600',
  email_failure: 'bg-red-50 text-red-600',
  assignment_update: 'bg-emerald-50 text-emerald-600',
  dispute: 'bg-rose-50 text-rose-600',
  system: 'bg-gray-50 text-gray-600',
}

const severityBadge: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-400 text-white',
  low: 'bg-gray-300 text-gray-700',
}

const severityLabel: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
}

// ---- Component ----

export default function AdminNotificationBell() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const {
    notifications,
    unreadCount,
    criticalCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useAdminNotifications()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = async (n: AdminNotification) => {
    if (!n.is_read) await markAsRead(n.id)
    if (n.action_link) router.push(n.action_link)
    setIsOpen(false)
  }

  // Bell colour: red if there are critical/high unread; amber otherwise
  const bellUrgent = criticalCount > 0

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 transition-colors relative group"
        aria-label="Admin notifications"
      >
        <Bell className={`h-5 w-5 transition-colors ${bellUrgent ? 'text-red-500' : 'text-gray-600 group-hover:text-gray-900'}`} />
        {unreadCount > 0 && (
          <span className={`absolute top-1 right-1 min-w-[18px] h-[18px] ${bellUrgent ? 'bg-red-500' : 'bg-amber-500'} text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[420px] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-sm">Admin Notifications</h3>
              {criticalCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {criticalCount} urgent
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); markAllAsRead() }}
                className="text-gray-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Severity filter pills */}
          <FilterBar notifications={notifications} />

          {/* List */}
          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-gray-900" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Bell className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No admin notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map(n => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onClick={handleNotificationClick}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
              <button
                onClick={() => { setIsOpen(false); router.push('/dashboard/admin/notifications') }}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors w-full text-center"
              >
                View all admin notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

function FilterBar({ notifications }: { notifications: AdminNotification[] }) {
  const counts = {
    critical: notifications.filter(n => !n.is_read && n.severity === 'critical').length,
    high: notifications.filter(n => !n.is_read && n.severity === 'high').length,
  }
  if (counts.critical === 0 && counts.high === 0) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100">
      <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
      <span className="text-xs text-red-700 font-medium">
        {counts.critical > 0 && `${counts.critical} critical`}
        {counts.critical > 0 && counts.high > 0 && ' · '}
        {counts.high > 0 && `${counts.high} high priority`}
        {' '}unread
      </span>
    </div>
  )
}

function NotificationRow({
  notification: n,
  onClick,
  onDelete,
}: {
  notification: AdminNotification
  onClick: (n: AdminNotification) => void
  onDelete: (id: string) => void
}) {
  const Icon = typeIcons[n.type] || Bell
  const colorClass = typeColors[n.type] || 'bg-gray-50 text-gray-600'

  return (
    <div
      className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer relative group ${
        !n.is_read ? 'bg-blue-50/30' : ''
      }`}
      onClick={() => onClick(n)}
    >
      {/* Unread dot */}
      {!n.is_read && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full" />
      )}

      <div className="flex gap-3 pl-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${severityBadge[n.severity]} flex-shrink-0`}>
                {severityLabel[n.severity]}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(n.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all flex-shrink-0"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
            {n.action_link && (
              <span className="text-[10px] text-primary font-medium">View →</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
