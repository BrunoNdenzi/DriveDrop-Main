'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { brokerProfileService } from '@/services/brokerService';
import {
  MessageSquare,
  Clock,
  Package,
  User,
  ChevronRight,
  Truck,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrokerConversation {
  assignment_id: string;
  shipment_id: string;
  carrier_id: string;
  carrier_name: string;
  assignment_status: string;
  vehicle_info: string;
  pickup_city: string;
  delivery_city: string;
  last_message_content: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export default function BrokerMessagesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<BrokerConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const realtimeChannelRef = useRef<any>(null);
  const supabase = getSupabaseBrowserClient();

  const loadConversations = useCallback(async () => {
    if (!profile?.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Get broker profile
      const brokerProfile = await brokerProfileService.getByProfileId(profile.id);
      if (!brokerProfile) {
        setError('Broker profile not found');
        setLoading(false);
        return;
      }

      // Get all assignments with carrier info and shipment info
      const { data: assignments, error: assignErr } = await supabase
        .from('broker_assignments')
        .select(`
          id,
          shipment_id,
          carrier_id,
          assignment_status,
          carrier:profiles!broker_assignments_carrier_id_fkey(id, first_name, last_name),
          shipment:shipments!broker_assignments_shipment_id_fkey(
            id, vehicle_make, vehicle_model, vehicle_year,
            pickup_city, pickup_state, delivery_city, delivery_state
          )
        `)
        .eq('broker_id', brokerProfile.id)
        .not('carrier_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (assignErr) throw assignErr;

      if (!assignments || assignments.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // For each assignment, get the last message and unread count
      const convPromises = assignments.map(async (a: any) => {
        const carrier = a.carrier as any;
        const shipment = a.shipment as any;

        // Get last message for this shipment between broker and carrier
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('shipment_id', a.shipment_id)
          .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get unread count
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('shipment_id', a.shipment_id)
          .eq('receiver_id', profile.id)
          .eq('is_read', false);

        return {
          assignment_id: a.id,
          shipment_id: a.shipment_id,
          carrier_id: a.carrier_id,
          carrier_name: carrier
            ? `${carrier.first_name || ''} ${carrier.last_name || ''}`.trim() || 'Unknown Carrier'
            : 'Unknown Carrier',
          assignment_status: a.assignment_status,
          vehicle_info: shipment
            ? `${shipment.vehicle_year || ''} ${shipment.vehicle_make || ''} ${shipment.vehicle_model || ''}`.trim()
            : 'N/A',
          pickup_city: shipment?.pickup_city || 'N/A',
          delivery_city: shipment?.delivery_city || 'N/A',
          last_message_content: lastMsg?.content || null,
          last_message_at: lastMsg?.created_at || null,
          unread_count: count || 0,
        } as BrokerConversation;
      });

      const convs = await Promise.all(convPromises);
      // Sort: unread first, then by last message time
      convs.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        if (a.last_message_at && b.last_message_at) {
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        }
        return a.last_message_at ? -1 : 1;
      });

      setConversations(convs);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, supabase]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('broker-messages-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [profile?.id, loadConversations, supabase]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffH = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffH < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (diffH < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'in_transit': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const filtered = conversations.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.carrier_name.toLowerCase().includes(term) ||
      c.vehicle_info.toLowerCase().includes(term) ||
      c.pickup_city.toLowerCase().includes(term) ||
      c.delivery_city.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">Communicate with your assigned carriers and drivers</p>
        </div>
        {conversations.some((c) => c.unread_count > 0) && (
          <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded-full">
            {conversations.reduce((sum, c) => sum + c.unread_count, 0)} unread
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by carrier, vehicle, or city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4"></div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Conversations */}
      {!loading && !error && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Conversations Yet</h3>
              <p className="text-gray-600">
                {searchTerm
                  ? 'No conversations match your search.'
                  : 'Assign carriers to your shipments to start messaging.'}
              </p>
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.assignment_id}
                onClick={() => router.push(`/dashboard/broker/messages/${conv.shipment_id}?carrier=${conv.carrier_id}`)}
                className="w-full text-left bg-white rounded-lg border border-gray-200 hover:border-teal-300 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                    <Truck className="h-5 w-5 text-teal-600" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 truncate">{conv.carrier_name}</span>
                      <div className="flex items-center gap-2">
                        {conv.last_message_at && (
                          <span className="text-xs text-gray-500">{formatTime(conv.last_message_at)}</span>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="bg-teal-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(conv.assignment_status)}`}>
                        {conv.assignment_status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{conv.vehicle_info}</span>
                    </div>

                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {conv.pickup_city} → {conv.delivery_city}
                    </p>

                    {conv.last_message_content ? (
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {conv.last_message_content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1 italic">No messages yet — start the conversation</p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-2" />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
