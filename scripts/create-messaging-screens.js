// Script to create clean messaging screen files
const fs = require('fs');
const path = require('path');

const conversationsContent = `import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    navigation.navigate('Chat' as never, {
      shipmentId: conversation.shipment_id,
      otherUserId,
      otherUserName,
      otherUserRole,
    } as never);
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
`;

const chatContent = `import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ChatScreenRouteProp = RouteProp<
  {
    Chat: {
      shipmentId: string;
      otherUserId: string;
      otherUserName: string;
      otherUserRole: 'client' | 'driver';
    };
  },
  'Chat'
>;

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

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const { shipmentId, otherUserId, otherUserName, otherUserRole } = route.params;
  const { userProfile } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const realtimeChannelRef = useRef<any>(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: otherUserName || 'Chat',
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => navigation.navigate('ShipmentDetails' as never, { id: shipmentId } as never)}
        >
          <MaterialIcons name="info-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, otherUserName, shipmentId]);

  const loadMessages = useCallback(async () => {
    if (!userProfile?.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setMessages(data || []);
      await markMessagesAsRead();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shipmentId, userProfile?.id]);

  const markMessagesAsRead = async () => {
    if (!userProfile?.id) return;
    try {
      const { error } = await supabase.rpc('mark_shipment_messages_read', {
        p_shipment_id: shipmentId,
      });
      if (error) console.error('Error marking messages as read:', error);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const setupRealtimeSubscription = useCallback(() => {
    if (!userProfile?.id) return;
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    const channel = supabase
      .channel(\`messages:\${shipmentId}\`)
      .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: \`shipment_id=eq.\${shipmentId}\`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          if (newMessage.sender_id !== userProfile.id) {
            markMessagesAsRead();
          }
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: \`shipment_id=eq.\${shipmentId}\`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          );
        }
      )
      .subscribe();
    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [shipmentId, userProfile?.id]);

  const sendMessage = async () => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || !userProfile?.id || sending) return;

    try {
      setSending(true);
      setError(null);
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          shipment_id: shipmentId,
          sender_id: userProfile.id,
          receiver_id: otherUserId,
          content: trimmedMessage,
          message_type: 'text',
          is_read: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setMessageText('');
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      Alert.alert('Error', err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [setupRealtimeSubscription]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      markMessagesAsRead();
    });
    return unsubscribe;
  }, [navigation]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (diffInHours < 48 && date.getDate() === now.getDate() - 1) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.sender_id === userProfile?.id;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateDivider =
      !previousMessage ||
      new Date(item.created_at).toDateString() !== new Date(previousMessage.created_at).toDateString();

    return (
      <>
        {showDateDivider && (
          <View style={styles.dateDivider}>
            <View style={styles.dateDividerLine} />
            <Text style={styles.dateDividerText}>
              {new Date(item.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: new Date(item.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
              })}
            </Text>
            <View style={styles.dateDividerLine} />
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.messageTime,
                  isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
                ]}
              >
                {formatTime(item.created_at)}
              </Text>
              {isOwnMessage && (
                <MaterialIcons
                  name={item.is_read ? 'done-all' : 'done'}
                  size={14}
                  color={item.is_read ? '#34B7F1' : 'rgba(255, 255, 255, 0.6)'}
                  style={styles.readIcon}
                />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="chat-bubble-outline" size={80} color="#E0E0E0" />
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Start a conversation with {otherUserName}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="#FF3B30" />
          <Text style={styles.errorText}>Failed to load messages</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMessages}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.messagesList}
          ListEmptyComponent={renderEmptyState}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder={\`Message \${otherUserName}...\`}
            placeholderTextColor="#999"
            multiline
            maxLength={5000}
            editable={!sending}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  headerRight: { marginRight: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 20, fontWeight: '600', color: '#333', marginTop: 16 },
  errorSubtext: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
  retryButton: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: '#007AFF', borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 22, fontWeight: '600', color: '#333', marginTop: 20 },
  emptySubtext: { fontSize: 16, color: '#999', marginTop: 8, textAlign: 'center' },
  dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dateDividerText: { fontSize: 12, color: '#999', marginHorizontal: 12, fontWeight: '500' },
  messageContainer: { marginVertical: 3, maxWidth: '80%' },
  ownMessageContainer: { alignSelf: 'flex-end' },
  otherMessageContainer: { alignSelf: 'flex-start' },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  ownMessageBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  otherMessageBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 21 },
  ownMessageText: { color: '#FFFFFF' },
  otherMessageText: { color: '#000000' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' },
  messageTime: { fontSize: 11, fontWeight: '500' },
  ownMessageTime: { color: 'rgba(255, 255, 255, 0.75)' },
  otherMessageTime: { color: '#999' },
  readIcon: { marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E5EA', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 10 : 12 },
  input: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, paddingTop: Platform.OS === 'ios' ? 10 : 10, fontSize: 16, maxHeight: 100, marginRight: 8, color: '#000' },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  sendButtonDisabled: { backgroundColor: '#C7C7CC', shadowOpacity: 0, elevation: 0 },
});
`;

// Write files
try {
  const targetDir = path.join(__dirname, '..', 'mobile', 'src', 'screens');
  fs.writeFileSync(path.join(targetDir, 'ConversationsScreen.tsx'), conversationsContent, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'ChatScreen.tsx'), chatContent, 'utf8');
  console.log('✅ Files created successfully!');
  console.log('  - ConversationsScreen.tsx');
  console.log('  - ChatScreen.tsx');
} catch (error) {
  console.error('❌ Error creating files:', error.message);
  process.exit(1);
}
