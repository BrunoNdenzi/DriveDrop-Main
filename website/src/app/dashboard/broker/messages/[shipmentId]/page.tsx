'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  Send,
  ArrowLeft,
  Info,
  Truck,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  id: string;
  shipment_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ShipmentInfo {
  id: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  status: string;
}

export default function BrokerChatPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const shipmentId = params.shipmentId as string;
  const carrierId = searchParams.get('carrier');

  const [messages, setMessages] = useState<Message[]>([]);
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carrierName, setCarrierName] = useState<string>('Carrier');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<any>(null);
  const supabase = getSupabaseBrowserClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load shipment and carrier details
  const loadDetails = useCallback(async () => {
    if (!shipmentId) return;

    try {
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('id, vehicle_make, vehicle_model, vehicle_year, pickup_city, pickup_state, delivery_city, delivery_state, status')
        .eq('id', shipmentId)
        .single();

      if (shipmentData) setShipment(shipmentData);

      // Get carrier name
      const cid = carrierId;
      if (cid) {
        const { data: carrierProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', cid)
          .single();

        if (carrierProfile) {
          setCarrierName(`${carrierProfile.first_name || ''} ${carrierProfile.last_name || ''}`.trim() || 'Carrier');
        }
      }
    } catch (err: any) {
      console.error('Error loading details:', err);
    }
  }, [shipmentId, carrierId, supabase]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!profile?.id || !shipmentId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('shipment_id', shipmentId)
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setMessages(data || []);

      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('shipment_id', shipmentId)
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [shipmentId, profile?.id, supabase]);

  // Realtime subscription
  const setupRealtime = useCallback(() => {
    if (!profile?.id || !shipmentId) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`broker-chat:${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Mark as read if received
          if (newMsg.sender_id !== profile.id) {
            supabase
              .from('messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .then();
          }

          setTimeout(scrollToBottom, 100);
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
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [shipmentId, profile?.id, supabase]);

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || !profile?.id || sending) return;

    const receiverId = carrierId;
    if (!receiverId) {
      setError('Cannot identify the carrier for this conversation.');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const { data, error: insertErr } = await supabase
        .from('messages')
        .insert({
          shipment_id: shipmentId,
          sender_id: profile.id,
          receiver_id: receiverId,
          content: trimmed,
          message_type: 'text',
          is_read: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setMessageText('');

      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadDetails();
    loadMessages();
  }, [loadDetails, loadMessages]);

  useEffect(() => {
    const cleanup = setupRealtime();
    return cleanup;
  }, [setupRealtime]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffH = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffH < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-gray-600">Please log in to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/broker/messages')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                <Truck className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">{carrierName}</h1>
                {shipment && (
                  <p className="text-xs text-gray-500">
                    {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                    {' • '}
                    {shipment.pickup_city} → {shipment.delivery_city}
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/broker/assignments`)}
            className="text-teal-500 hover:text-teal-600"
            title="View Assignment"
          >
            <Info className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="space-y-4 max-w-3xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Messages Yet</h3>
              <p className="text-gray-600">Send the first message to your carrier</p>
            </div>
          )}

          {!loading &&
            messages.map((message) => {
              const isOwn = message.sender_id === profile.id;
              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-md px-4 py-2 rounded-2xl ${
                      isOwn
                        ? 'bg-teal-500 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-teal-100' : 'text-gray-500'}`}>
                      {formatTime(message.created_at)}
                      {isOwn && message.is_read && ' • Read'}
                    </p>
                  </div>
                </div>
              );
            })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-3xl mx-auto">
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
            className="bg-teal-500 hover:bg-teal-600 text-white"
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
      </div>
    </div>
  );
}
