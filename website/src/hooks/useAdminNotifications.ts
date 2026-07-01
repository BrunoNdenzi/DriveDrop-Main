'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface AdminNotification {
  id: string
  type: string
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  action_link: string | null
  is_read: boolean
  read_at: string | null
  data: Record<string, unknown>
  created_at: string
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[useAdminNotifications] fetch error:', error)
      setLoading(false)
      return
    }

    const items = (data || []) as AdminNotification[]
    setNotifications(items)
    setUnreadCount(items.filter(n => !n.is_read).length)
    setCriticalCount(items.filter(n => !n.is_read && (n.severity === 'critical' || n.severity === 'high')).length)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchNotifications()
    let channel: RealtimeChannel

    channel = supabase
      .channel('admin_notifications_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const n = payload.new as AdminNotification
            setNotifications(prev => [n, ...prev].slice(0, 50))
            if (!n.is_read) {
              setUnreadCount(prev => prev + 1)
              if (n.severity === 'critical' || n.severity === 'high') {
                setCriticalCount(prev => prev + 1)
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new as AdminNotification : n)
            )
            // Recompute counts from scratch on update
            fetchNotifications()
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
            fetchNotifications()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifications, supabase])

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    setCriticalCount(prev => {
      const n = notifications.find(x => x.id === id)
      if (n && !n.is_read && (n.severity === 'critical' || n.severity === 'high')) return Math.max(0, prev - 1)
      return prev
    })
  }, [supabase, notifications])

  const markAllAsRead = useCallback(async () => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    setCriticalCount(0)
  }, [supabase])

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from('admin_notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [supabase])

  return {
    notifications,
    unreadCount,
    criticalCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  }
}
