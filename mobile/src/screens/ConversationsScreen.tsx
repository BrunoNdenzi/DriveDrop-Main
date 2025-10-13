/**
 * ConversationsScreen - List of all message conversations
 * Clean, responsive implementation for both clients and drivers
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Conversation {
  id: string;
  shipmentId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  shipmentStatus: string;
  canMessage: boolean;
}

export default function ConversationsScreen() {
  const navigation = useNavigation<any>();
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConversations();
    setupRealtimeSubscription();
  }, [userProfile]);

  const loadConversations = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);

      // Get shipments where user is either client or driver
      const { data: shipments, error } = await supabase
        .from('shipments')
        .select(`
          id,
          status,
          client_id,
          driver_id,
          client:client_id(id, first_name, last_name, role),
          driver:driver_id(id, first_name, last_name, role)
        `)
        .or(`client_id.eq.${userProfile.id},driver_id.eq.${userProfile.id}`)
        .not('driver_id', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // For each shipment, get the last message
      const conversationsData = await Promise.all(
        (shipments || []).map(async (shipment: any) => {
          const otherUser = 
            userProfile.id === shipment.client_id 
              ? shipment.driver 
              : shipment.client;

          if (!otherUser) return null;

          // Get last message for this shipment
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .eq('shipment_id', shipment.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMsg = (messages && messages.length > 0 ? messages[0] : null) as any;

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('shipment_id', shipment.id)
            .eq('receiver_id', userProfile.id)
            .eq('is_read', false);

          // Check if messaging is allowed (active shipments + 24h after delivery)
          const canMessage = checkMessagingAllowed(shipment.status, shipment.updated_at);

          return {
            id: shipment.id,
            shipmentId: shipment.id,
            otherUserId: otherUser.id,
            otherUserName: `${otherUser.first_name} ${otherUser.last_name}`,
            otherUserRole: otherUser.role,
            lastMessage: lastMsg?.content || 'No messages yet',
            lastMessageTime: lastMsg?.created_at || shipment.updated_at,
            unreadCount: unreadCount || 0,
            shipmentStatus: shipment.status,
            canMessage,
          };
        })
      );

      setConversations(conversationsData.filter(Boolean) as Conversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!userProfile?.id) return;

    const channel = supabase
      .channel('conversations')
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

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const checkMessagingAllowed = (status: string, updatedAt: string): boolean => {
    const activeStatuses = ['pending', 'accepted', 'in_transit', 'picked_up'];
    if (activeStatuses.includes(status)) return true;

    // Allow 24 hours after delivery
    if (status === 'delivered') {
      const deliveredTime = new Date(updatedAt).getTime();
      const now = new Date().getTime();
      const hoursSinceDelivery = (now - deliveredTime) / (1000 * 60 * 60);
      return hoursSinceDelivery < 24;
    }

    return false;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleConversationPress = (conversation: Conversation) => {
    if (!conversation.canMessage) {
      alert('This conversation has expired (24 hours after delivery)');
      return;
    }

    navigation.navigate('ChatScreen', {
      shipmentId: conversation.shipmentId,
      otherUserId: conversation.otherUserId,
      otherUserName: conversation.otherUserName,
      otherUserRole: conversation.otherUserRole,
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, !item.canMessage && styles.expiredItem]}
      onPress={() => handleConversationPress(item)}
      disabled={!item.canMessage}
    >
      <View style={styles.avatar}>
        <MaterialIcons 
          name={item.otherUserRole === 'driver' ? 'local-shipping' : 'person'} 
          size={24} 
          color="#fff" 
        />
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.otherUserName}</Text>
          <Text style={styles.conversationTime}>{formatTime(item.lastMessageTime)}</Text>
        </View>

        <View style={styles.conversationFooter}>
          <Text 
            style={[
              styles.lastMessage, 
              !item.canMessage && styles.expiredText
            ]} 
            numberOfLines={1}
          >
            {!item.canMessage ? 'Conversation expired' : item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="chat-bubble-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Conversations</Text>
      <Text style={styles.emptyText}>
        {userProfile?.role === 'driver' 
          ? 'Conversations will appear when you\'re assigned to shipments'
          : 'Conversations will appear when drivers are assigned to your shipments'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadConversations();
            }}
            tintColor="#007AFF"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  expiredItem: {
    opacity: 0.5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  conversationTime: {
    fontSize: 13,
    color: '#999',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 15,
    color: '#666',
  },
  expiredText: {
    fontStyle: 'italic',
    color: '#999',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});
