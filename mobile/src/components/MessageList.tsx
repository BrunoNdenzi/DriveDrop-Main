import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/DesignSystem';

// Local type definitions if import fails
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  content: string;
  created_at: string;
  is_read: boolean;
  shipment_id: string;
}

interface MessageGroup {
  date: string;
  messages: Message[];
}

interface MessageItemProps {
  message: Message;
  isFromMe: boolean;
}

// Simple message item component if import fails
const MessageItem = ({ message, isFromMe }: MessageItemProps) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[
      styles.messageContainer,
      isFromMe ? styles.myMessageContainer : styles.theirMessageContainer,
    ]}>
      <View style={[
        styles.messageBubble,
        isFromMe ? styles.myMessageBubble : styles.theirMessageBubble,
      ]}>
        <Text style={[
          styles.messageText,
          isFromMe ? styles.myMessageText : styles.theirMessageText,
        ]}>
          {message.content}
        </Text>
      </View>
      <Text style={[
        styles.messageTime,
        isFromMe ? styles.myMessageTime : styles.theirMessageTime,
      ]}>
        {formatTime(message.created_at)}
      </Text>
    </View>
  );
};

interface MessageListProps {
  messageGroups: MessageGroup[];
  userId: string;
}

/**
 * A dedicated component for rendering the message list,
 * separated from the main screen to improve performance and readability
 */
export const MessageList = ({ messageGroups, userId }: MessageListProps) => {
  // Render a date separator for message groups
  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{date}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  // FlatList items render - each item is a group of messages for a specific date
  const renderGroup = ({ item }: { item: MessageGroup }) => (
    <View>
      {renderDateSeparator(item.date)}
      {item.messages.map((message: Message) => (
        <MessageItem 
          key={message.id} 
          message={message} 
          isFromMe={message.sender_id === userId} 
        />
      ))}
    </View>
  );

  return (
    <FlatList
      data={messageGroups}
      renderItem={renderGroup}
      keyExtractor={(item) => item.date}
      contentContainerStyle={styles.messagesListContent}
    />
  );
};

const styles = StyleSheet.create({
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dateText: {
    marginHorizontal: 8,
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  messagesListContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  // Message item styles
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 16,
    maxWidth: '85%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 2,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  theirMessageText: {
    color: Colors.text.primary,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.text.secondary,
    opacity: 0.7,
  },
  myMessageTime: {
    alignSelf: 'flex-end',
  },
  theirMessageTime: {
    alignSelf: 'flex-start',
  },
});
