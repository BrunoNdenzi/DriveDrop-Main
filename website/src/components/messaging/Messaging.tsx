'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { Send, Loader2, Check, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Message {
  id: string
  shipment_id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
  sender?: {
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

interface MessagingProps {
  shipmentId: string
  receiverId: string
  receiverName: string
  onClose?: () => void
}

export default function Messaging({ shipmentId, receiverId, receiverName, onClose }: MessagingProps) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchMessages()
    
    // Subscribe to new messages
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
          setMessages(prev => [...prev, payload.new as Message])
          scrollToBottom()
          
          // Mark as read if message is for current user
          if (payload.new.receiver_id === profile?.id) {
            markAsRead(payload.new.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [shipmentId, profile?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    if (!profile?.id) return

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])
      
      // Mark unread messages as read
      const unreadMessages = data?.filter(
        m => !m.is_read && m.receiver_id === profile.id
      )
      
      if (unreadMessages && unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', unreadMessages.map(m => m.id))
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (messageId: string) => {
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', messageId)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !profile?.id) return

    setSending(true)

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          shipment_id: shipmentId,
          sender_id: profile.id,
          receiver_id: receiverId,
          content: newMessage.trim(),
          message_type: 'text',
        })

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600">
              Start a conversation with {receiverName}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isSender = message.sender_id === profile?.id
              const senderName = message.sender
                ? `${message.sender.first_name} ${message.sender.last_name}`
                : 'Unknown'

              return (
                <div
                  key={message.id}
                  className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${isSender ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {!isSender && (
                      <span className="text-xs text-gray-500 px-3">{senderName}</span>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isSender
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-3">
                      <span className="text-xs text-gray-500">
                        {formatTime(message.created_at)}
                      </span>
                      {isSender && (
                        <span className="text-xs">
                          {message.is_read ? (
                            <CheckCheck className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Check className="h-3 w-3 text-gray-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${receiverName}...`}
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(e)
              }
            }}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-blue-500 hover:bg-blue-600 self-end"
            size="icon"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift + Enter for new line
        </p>
      </div>
    </div>
  )
}
