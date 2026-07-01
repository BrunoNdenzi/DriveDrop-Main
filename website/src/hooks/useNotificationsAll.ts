'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Notification } from './useNotifications'

export function useNotificationsAll() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    let channel: RealtimeChannel

    const fetchAll = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setNotifications(data || [])
      } catch (err) {
        console.error('Error fetching notifications:', err)
      } finally {
        setLoading(false)
      }
    }

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      channel = supabase
        .channel('notifications-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          if (payload.eventType === 'INSERT') setNotifications(prev => [payload.new as Notification, ...prev])
          else if (payload.eventType === 'UPDATE') setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n))
          else if (payload.eventType === 'DELETE') setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
        })
        .subscribe()
    }

    fetchAll()
    setupRealtime()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
  }

  const clearAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').delete().eq('user_id', user.id)
    setNotifications([])
  }

  return { notifications, loading, markAsRead, markAllAsRead, deleteNotification, clearAll }
}
