'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CheckCheck, Trash2, AlertTriangle,
  Package, CreditCard, UserCheck, Mail,
  ShieldAlert, MessageCircle, Filter,
} from 'lucide-react'
import { useAdminNotifications, type AdminNotification } from '@/hooks/useAdminNotifications'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'
type ReadFilter = 'all' | 'unread' | 'read'

const typeIcons: Record<string, typeof Bell> = {
  new_shipment: Package,
  driver_application: UserCheck,
  payment_failed: CreditCard,
  support_ticket: MessageCircle,
  deletion_request: Trash2,
  email_failure: Mail,
  assignment_update: CheckCheck,
  dispute: ShieldAlert,
  system: Bell,
}

const typeColors: Record<string, string> = {
  new_shipment: 'bg-purple-100 text-purple-700',
  driver_application: 'bg-blue-100 text-blue-700',
  payment_failed: 'bg-red-100 text-red-700',
  support_ticket: 'bg-cyan-100 text-cyan-700',
  deletion_request: 'bg-orange-100 text-orange-700',
  email_failure: 'bg-red-100 text-red-700',
  assignment_update: 'bg-emerald-100 text-emerald-700',
  dispute: 'bg-rose-100 text-rose-700',
  system: 'bg-gray-100 text-gray-600',
}

const severityConfig: Record<string, { label: string; badge: string; row: string }> = {
  critical: { label: 'Critical', badge: 'bg-red-600 text-white', row: 'border-l-4 border-red-500' },
  high:     { label: 'High',     badge: 'bg-orange-500 text-white', row: 'border-l-4 border-orange-400' },
  medium:   { label: 'Medium',   badge: 'bg-amber-400 text-white', row: 'border-l-4 border-amber-300' },
  low:      { label: 'Low',      badge: 'bg-gray-300 text-gray-700', row: '' },
}

export default function AdminNotificationsPage() {
  const router = useRouter()
  const {
    notifications,
    unreadCount,
    criticalCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useAdminNotifications()

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = notifications.filter(n => {
    if (severityFilter !== 'all' && n.severity !== severityFilter) return false
    if (readFilter === 'unread' && n.is_read) return false
    if (readFilter === 'read' && !n.is_read) return false
    if (typeFilter !== 'all' && n.type !== typeFilter) return false
    return true
  })

  const uniqueTypes = Array.from(new Set(notifications.map(n => n.type)))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            {criticalCount > 0 && ` · ${criticalCount} critical/high`}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            className="flex items-center gap-1.5"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {criticalCount} critical or high-priority notification{criticalCount > 1 ? 's' : ''} require{criticalCount === 1 ? 's' : ''} your attention.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />

        {/* Read state */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {(['all', 'unread', 'read'] as ReadFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setReadFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${readFilter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Severity */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${severityFilter === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {s === 'all' ? 'All' : severityConfig[s].label}
            </button>
          ))}
        </div>

        {/* Type */}
        {uniqueTypes.length > 1 && (
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            <option value="all">All types</option>
            {uniqueTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No notifications match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotificationCard
              key={n.id}
              notification={n}
              onMarkRead={markAsRead}
              onDelete={deleteNotification}
              onNavigate={(link) => router.push(link)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Card ----

function NotificationCard({
  notification: n,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: AdminNotification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  onNavigate: (link: string) => void
}) {
  const Icon = typeIcons[n.type] || Bell
  const color = typeColors[n.type] || 'bg-gray-100 text-gray-600'
  const sv = severityConfig[n.severity] || severityConfig.low

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${sv.row} ${!n.is_read ? 'shadow-sm' : 'opacity-75'}`}>
      <div className="p-4 flex gap-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sv.badge}`}>
                {sv.label}
              </span>
              {!n.is_read && (
                <span className="w-2 h-2 bg-amber-500 rounded-full inline-block" />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {!n.is_read && (
                <button
                  onClick={() => onMarkRead(n.id)}
                  title="Mark as read"
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => onDelete(n.id)}
                title="Delete"
                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-1">{n.message}</p>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              {' · '}
              <span className="capitalize">{n.type.replace(/_/g, ' ')}</span>
            </p>
            {n.action_link && (
              <button
                onClick={() => onNavigate(n.action_link!)}
                className="text-xs text-primary hover:underline font-medium"
              >
                View details →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
