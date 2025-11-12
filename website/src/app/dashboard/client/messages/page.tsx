'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useCallback, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { 
  MessageSquare,
  Clock,
  Package,
  User,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Conversation {
  shipment_id: string
  shipment_title: string
  shipment_status: string
  client_id: string
  driver_id: string
  client_name: string
  client_avatar: string | null
  driver_name: string
  driver_avatar: string | null
  last_message_content: string | null
  last_message_at: string | null
  unread_count: number
}

export default function ClientMessagesPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const realtimeChannelRef = useRef<any>(null)
  const supabase = getSupabaseBrowserClient()

  const loadConversations = useCallback(async () => {
    if (!profile?.id) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    try {
      setError(null)
      const { data, error: queryError } = await supabase
        .from('conversation_summaries')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (queryError) throw queryError

      // Filter valid conversations
      const validConversations = (data || [])
        .filter(conv => 
          conv.shipment_id && 
          conv.client_id && 
          conv.driver_id &&
          (conv.client_id === profile.id || conv.driver_id === profile.id)
        )
        .map(conv => conv as Conversation)

      setConversations(validConversations)
    } catch (err: any) {
      console.error('Error loading conversations:', err)
      setError(err.message || 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, supabase])

  // Setup real-time subscription for new messages
  const setupRealtimeSubscription = useCallback(() => {
    if (!profile?.id) return

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations()
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [profile?.id, loadConversations, supabase])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [setupRealtimeSubscription])

  const navigateToChat = (conversation: Conversation) => {
    const isClient = profile?.id === conversation.client_id
    const otherUserId = isClient ? conversation.driver_id : conversation.client_id
    const otherUserName = isClient ? conversation.driver_name : conversation.client_name

    if (!conversation.shipment_id) {
      alert('Invalid shipment ID')
      return
    }

    if (!otherUserId) {
      alert(
        isClient
          ? 'This shipment has not been assigned to a driver yet.'
          : 'Cannot identify the client for this shipment.'
      )
      return
    }

    router.push(`/dashboard/client/messages/${conversation.shipment_id}`)
  }

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7)
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getStatusBadgeColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      accepted: 'bg-teal-100 text-teal-800',
      picked_up: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view messages</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-teal-600" />
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        </div>
        <p className="text-gray-600">
          Chat with drivers about your shipments
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading conversations...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
          <Button
            onClick={loadConversations}
            className="mt-2 bg-red-600 hover:bg-red-700 text-white"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conversations.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Conversations Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Messages will appear here once your shipments are picked up
          </p>
          <Button
            onClick={() => router.push('/dashboard/client/shipments')}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Package className="h-4 w-4 mr-2" />
            View My Shipments
          </Button>
        </div>
      )}

      {/* Conversations List */}
      {!loading && !error && conversations.length > 0 && (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
          {conversations.map((conversation) => {
            const isClient = profile.id === conversation.client_id
            const otherUserName = isClient
              ? conversation.driver_name
              : conversation.client_name
            const otherUserAvatar = isClient
              ? conversation.driver_avatar
              : conversation.client_avatar

            return (
              <button
                key={conversation.shipment_id}
                onClick={() => navigateToChat(conversation)}
                className="w-full p-4 hover:bg-gray-50 transition-colors text-left flex items-center gap-4"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {otherUserAvatar ? (
                    <img
                      src={otherUserAvatar}
                      alt={otherUserName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-teal-700 font-semibold text-sm">
                        {getInitials(otherUserName)}
                      </span>
                    </div>
                  )}
                  {conversation.unread_count > 0 && (
                    <div className="absolute -mt-10 ml-8 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {conversation.unread_count > 9
                        ? '9+'
                        : conversation.unread_count}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {otherUserName || 'Unknown User'}
                      </h3>
                      {isClient && (
                        <span className="text-xs text-gray-500">(Driver)</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {formatTime(conversation.last_message_at)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2 truncate">
                    {conversation.shipment_title}
                  </p>

                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm truncate ${
                        conversation.unread_count > 0
                          ? 'font-semibold text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {conversation.last_message_content ||
                        'No messages yet'}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(
                        conversation.shipment_status
                      )}`}
                    >
                      {conversation.shipment_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* Refresh Button */}
      {!loading && conversations.length > 0 && (
        <div className="mt-6 text-center">
          <Button
            onClick={loadConversations}
            variant="outline"
            className="text-gray-600"
          >
            <Clock className="h-4 w-4 mr-2" />
            Refresh Conversations
          </Button>
        </div>
      )}
    </div>
  )
}
