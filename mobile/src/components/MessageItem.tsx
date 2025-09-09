import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types/MessageTypes';
import { Colors } from '../constants/DesignSystem';

interface MessageItemProps {
  message: Message;
  isFromMe: boolean;
}

/**
 * A dedicated component for rendering a single message item
 */
export const MessageItem = ({ message, isFromMe }: MessageItemProps) => {
  // Format time display for messages
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

const styles = StyleSheet.create({
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
    padding: 12,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: 3,
  },
  myMessageTime: {
    alignSelf: 'flex-end',
  },
  theirMessageTime: {
    alignSelf: 'flex-start',
  },
});
