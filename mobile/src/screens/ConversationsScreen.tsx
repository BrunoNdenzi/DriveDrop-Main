import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Conversation {
  shipment_id: string;
  shipment_title: string;
  shipment_status: string;
  client_id: string;
  driver_id: string;
  client_name: string;
  client_avatar: string | null;
  driver_name: string;
  driver_avatar: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export default function ConversationsScreen() {
  const navigation = useNavigation();
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  const loadConversations = useCallback(async () => {
    if (!userProfile?.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('conversation_summaries')
        .select('*')
        .in('shipment_status', ['picked_up', 'in_transit', 'delivered']) // Only active/completed shipments
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (queryError) throw queryError;
      setConversations(data || []);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
      Alert.alert('Error', 'Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.id]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!userProfile?.id) return;
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadConversations();
      })
      .subscribe();
    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [userProfile?.id, loadConversations]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  useFocusEffect(useCallback(() => {
    loadConversations();
  }, [loadConversations]));

  useEffect(() => {
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [setupRealtimeSubscription]);

  const navigateToChat = (conversation: Conversation) => {
    const isClient = userProfile?.id === conversation.client_id;
    const otherUserId = isClient ? conversation.driver_id : conversation.client_id;
    const otherUserName = isClient ? conversation.driver_name : conversation.client_name;
    const otherUserRole = isClient ? 'driver' : 'client';
    
    // Validation: Don't navigate if essential data is missing
    if (!conversation.shipment_id) {
      Alert.alert('Error', 'Invalid shipment ID');
      return;
    }
    
    if (!otherUserId) {
      Alert.alert(
        'Cannot Open Chat',
        isClient 
          ? 'This shipment has not been assigned to a driver yet.'
          : 'Cannot identify the client for this shipment.'
      );
      return;
    }
    
    (navigation.navigate as any)('ChatScreen', {
      shipmentId: conversation.shipment_id,
      otherUserId,
      otherUserName: otherUserName || 'Unknown User',
      otherUserRole,
    });
  };

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: '#FF9500',
      accepted: '#007AFF',
      in_transit: '#34C759',
      picked_up: '#34C759',
      delivered: '#00C7BE',
      cancelled: '#FF3B30',
    };
    return colors[status] || '#8E8E93';
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      accepted: 'Accepted',
      in_transit: 'In Transit',
      picked_up: 'Picked Up',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isClient = userProfile?.id === item.client_id;
    const otherUserName = isClient ? item.driver_name : item.client_name;
    const otherUserAvatar = isClient ? item.driver_avatar : item.client_avatar;
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, hasUnread && styles.conversationItemUnread]}
        onPress={() => navigateToChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {otherUserAvatar ? (
            <Image source={{ uri: otherUserAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{otherUserName?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationName, hasUnread && styles.textBold]}>
              {otherUserName || 'Unknown User'}
            </Text>
            {item.last_message_at && (
              <Text style={[styles.conversationTime, hasUnread && styles.textBold]}>
                {formatTime(item.last_message_at)}
              </Text>
            )}
          </View>
          <View style={styles.shipmentInfo}>
            <Text style={styles.shipmentTitle} numberOfLines={1}>{item.shipment_title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.shipment_status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.shipment_status) }]}>
                {getStatusLabel(item.shipment_status)}
              </Text>
            </View>
          </View>
          <View style={styles.lastMessageContainer}>
            {item.last_message_content ? (
              <>
                <Text style={[styles.lastMessage, hasUnread && styles.textBold]} numberOfLines={1}>
                  {item.last_message_content}
                </Text>
                {hasUnread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noMessages}>No messages yet</Text>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="chat-bubble-outline" size={80} color="#E0E0E0" />
        <Text style={styles.emptyText}>No conversations yet</Text>
        <Text style={styles.emptySubtext}>Start a shipment to begin chatting with drivers</Text>
      </View>
    );
  };

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

  if (error && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="#FF3B30" />
          <Text style={styles.errorText}>Failed to load conversations</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.shipment_id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 20, fontWeight: '600', color: '#333', marginTop: 16 },
  errorSubtext: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
  retryButton: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: '#007AFF', borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContent: { paddingVertical: 8 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 22, fontWeight: '600', color: '#333', marginTop: 20 },
  emptySubtext: { fontSize: 16, color: '#999', marginTop: 8, textAlign: 'center' },
  conversationItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14 },
  conversationItemUnread: { backgroundColor: '#F0F8FF' },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '600', color: '#FFFFFF' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: '#FFFFFF' },
  conversationContent: { flex: 1, marginRight: 8 },
  conversationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  conversationName: { fontSize: 17, fontWeight: '600', color: '#000', flex: 1 },
  conversationTime: { fontSize: 13, color: '#8E8E93', marginLeft: 8 },
  shipmentInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  shipmentTitle: { fontSize: 14, color: '#666', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  lastMessageContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { fontSize: 15, color: '#8E8E93', flex: 1 },
  noMessages: { fontSize: 15, color: '#C7C7CC', fontStyle: 'italic' },
  textBold: { fontWeight: '600', color: '#000' },
  unreadBadge: { backgroundColor: '#007AFF', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: 8 },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#E5E5EA', marginLeft: 84 },
});
