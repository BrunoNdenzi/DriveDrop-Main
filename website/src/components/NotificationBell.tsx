'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, CheckCheck, X, Package, CreditCard, Truck, MessageCircle, AlertCircle } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

const notificationIcons = {
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

const notificationColors = {
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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    
    // Handle navigation based on notification type
    if (notification.data?.link) {
      window.location.href = notification.data.link
    }
  }

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await markAllAsRead()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-100 transition-colors relative group"
      >
        <Bell className="h-5 w-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-md border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-white/90 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[450px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No notifications yet</p>
                <p className="text-gray-400 text-xs mt-1">We'll notify you when something happens</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type]
                  const colorClass = notificationColors[notification.type]

                  return (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer relative group ${
                        !notification.is_read ? 'bg-blue-50/30' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Unread Indicator */}
                      {!notification.is_read && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full"></div>
                      )}

                      <div className="flex gap-3 pl-4">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-md ${colorClass} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                              {notification.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notification.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                            >
                              <X className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer - Only show if there are notifications */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
              <button className="text-xs text-primary hover:text-primary-dark font-medium transition-colors w-full text-center">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
