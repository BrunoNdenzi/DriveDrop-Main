'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useCallback, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useRouter, useParams } from 'next/navigation'
import { 
  Send,
  ArrowLeft,
  Info,
  User,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  shipment_id: string
  sender_id: string
  receiver_id: string
  content: string
  message_type: string
  is_read: boolean
  read_at: string | null
  created_at: string
  updated_at: string
}

interface Shipment {
  id: string
  title: string
  status: string
  client_id: string
  driver_id: string | null
  pickup_address: string
  delivery_address: string
}

export default function ClientChatPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const params = useParams()
  const shipmentId = params.shipmentId as string
  
  const [messages, setMessages] = useState<Message[]>([])
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otherUserName, setOtherUserName] = useState<string>('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const realtimeChannelRef = useRef<any>(null)
  const supabase = getSupabaseBrowserClient()

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load shipment details
  const loadShipment = useCallback(async () => {
    if (!shipmentId) return

    try {
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('id, title, status, client_id, driver_id, pickup_address, delivery_address')
        .eq('id', shipmentId)
        .single()

      if (shipmentError) throw shipmentError
      setShipment(shipmentData)

      // Get other user's name
      if (profile?.id === shipmentData.client_id && shipmentData.driver_id) {
        const { data: driverProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', shipmentData.driver_id)
          .single()
        
        if (driverProfile) {
          setOtherUserName(`${driverProfile.first_name} ${driverProfile.last_name}`)
        }
      }
    } catch (err: any) {
      console.error('Error loading shipment:', err)
      setError(err.message)
    }
  }, [shipmentId, profile?.id, supabase])

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!profile?.id || !shipmentId) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    try {
      setError(null)
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: true })

      if (queryError) throw queryError
      setMessages(data || [])

      // Mark messages as read
      await markMessagesAsRead()

      // Scroll to bottom after loading
      setTimeout(scrollToBottom, 100)
    } catch (err: any) {
      console.error('Error loading messages:', err)
      setError(err.message || 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [shipmentId, profile?.id, supabase])

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!profile?.id || !shipmentId) return

    try {
      await supabase.rpc('mark_shipment_messages_read', {
        p_shipment_id: shipmentId,
      })
    } catch (err) {
      console.error('Error marking messages as read:', err)
    }
  }

  // Setup real-time subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!profile?.id || !shipmentId) return

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    const channel = supabase
      .channel(`messages:${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })

          // Mark as read if not from current user
          if (newMessage.sender_id !== profile.id) {
            markMessagesAsRead()
          }

          setTimeout(scrollToBottom, 100)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          )
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [shipmentId, profile?.id, supabase])

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedMessage = messageText.trim()
    if (!trimmedMessage || !profile?.id || sending || !shipment) return

    // Validate we have a driver
    if (!shipment.driver_id) {
      alert('This shipment has not been assigned to a driver yet.')
      return
    }

    try {
      setSending(true)
      setError(null)

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          shipment_id: shipmentId,
          sender_id: profile.id,
          receiver_id: shipment.driver_id,
          content: trimmedMessage,
          message_type: 'text',
          is_read: false,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setMessageText('')

      // Add message to list if not already there
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data]
        })
        setTimeout(scrollToBottom, 100)
      }
    } catch (err: any) {
      console.error('Error sending message:', err)
      setError(err.message || 'Failed to send message')
      alert(err.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadShipment()
    loadMessages()
  }, [loadShipment, loadMessages])

  // Setup realtime
  useEffect(() => {
    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [setupRealtimeSubscription])

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/client/messages')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {otherUserName || 'Driver'}
              </h1>
              {shipment && (
                <p className="text-sm text-gray-600">{shipment.title}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/client/shipments/${shipmentId}`)}
            className="text-teal-600 hover:text-teal-700"
          >
            <Info className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading messages...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Messages */}
          {!loading &&
            messages.map((message) => {
              const isOwnMessage = message.sender_id === profile.id

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-teal-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-teal-100' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.created_at)}
                      {isOwnMessage && message.is_read && ' • Read'}
                    </p>
                  </div>
                </div>
              )
            })}

          {/* Empty State */}
          {!loading && messages.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Messages Yet
              </h3>
              <p className="text-gray-600">
                Start the conversation with your driver
              </p>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          {shipment && !shipment.driver_id ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-yellow-800 text-sm">
                This shipment has not been assigned to a driver yet. Messaging
                will be enabled once a driver accepts.
              </p>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <Input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1"
                maxLength={2000}
              />
              <Button
                type="submit"
                disabled={!messageText.trim() || sending}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
