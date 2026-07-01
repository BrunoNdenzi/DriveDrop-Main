'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Check, CheckCheck, Trash2, Package, CreditCard, Truck, MessageCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotificationsAll } from '@/hooks/useNotificationsAll'
import { formatDistanceToNow } from 'date-fns'

const notificationIcons: Record<string, any> = {
  payment: CreditCard,
  payment_success: CreditCard,
  payment_failed: AlertCircle,
  shipment_created: Package,
  shipment_updated: Package,
  driver_assigned: Truck,
  delivery_completed: Check,
  message_received: MessageCircle,
  system: Bell,
}

const notificationColors: Record<string, string> = {
  payment: 'bg-blue-50 text-blue-600',
  payment_success: 'bg-green-50 text-green-600',
  payment_failed: 'bg-red-50 text-red-600',
  shipment_created: 'bg-purple-50 text-purple-600',
  shipment_updated: 'bg-amber-50 text-amber-600',
  driver_assigned: 'bg-indigo-50 text-indigo-600',
  delivery_completed: 'bg-emerald-50 text-emerald-600',
  message_received: 'bg-cyan-50 text-cyan-600',
  system: 'bg-gray-50 text-gray-600',
}

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotificationsAll()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleClick = async (id: string, isRead: boolean, link?: string) => {
    if (!isRead) await markAsRead(id)
    setExpandedId(prev => prev === id ? null : id)
    if (link) window.location.href = link
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="text-xs gap-1">
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={clearAll} className="text-xs gap-1 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No notifications</p>
            <p className="text-gray-400 text-sm mt-1">We'll notify you when something happens</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] ?? Bell
              const colorClass = notificationColors[notification.type] ?? 'bg-gray-50 text-gray-600'
              const isExpanded = expandedId === notification.id

              return (
                <div
                  key={notification.id}
                  className={`px-4 py-3 transition-colors group ${!notification.is_read ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex gap-3">
                    {/* Unread dot */}
                    <div className="flex items-start pt-1">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notification.is_read ? 'bg-amber-500' : 'bg-transparent'}`} />
                    </div>

                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-md ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClick(notification.id, notification.is_read, notification.data?.link)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-sm text-gray-600 mt-0.5 ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {notification.message}
                      </p>
                      {notification.message.length > 120 && (
                        <button className="text-xs text-primary mt-1 hover:underline">
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          title="Mark as read"
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Check className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        title="Delete"
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <X className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
