import React, { useState, useEffect, useRef, useCallback } from 'react';
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
          onPress={() => {
            if (!shipmentId || shipmentId === 'undefined') {
              Alert.alert('Error', 'Invalid shipment ID');
              return;
            }
            // Use correct param name: shipmentId not id
            (navigation.navigate as any)('ShipmentDetails', { shipmentId: shipmentId });
          }}
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
      const { error } = await (supabase.rpc as any)('mark_shipment_messages_read', {
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
      .channel(`messages:${shipmentId}`)
      .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `shipment_id=eq.${shipmentId}`,
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
          filter: `shipment_id=eq.${shipmentId}`,
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

    // Validate we have a receiver
    if (!otherUserId) {
      Alert.alert(
        'Cannot Send Message',
        'This shipment has not been assigned to a driver yet. Messages can only be sent once a driver is assigned.'
      );
      return;
    }

    try {
      setSending(true);
      setError(null);
      
      // TypeScript workaround for Supabase types
      const { data, error: insertError } = await (supabase.from('messages') as any)
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
          if (prev.some((m: any) => m.id === data.id)) return prev;
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
            placeholder={`Message ${otherUserName}...`}
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
  messagesList: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 12 }, // Increased from 20 to 32
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
