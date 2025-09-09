import React from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/DesignSystem';

interface MessageInputProps {
  message: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isSending: boolean;
}

/**
 * A dedicated component for rendering the message input area
 */
export const MessageInput = ({
  message,
  onChangeText,
  onSend,
  isSending
}: MessageInputProps) => {
  const isButtonDisabled = !message.trim() || isSending;

  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.messageInput}
        placeholder="Type a message..."
        value={message}
        onChangeText={onChangeText}
        multiline
        maxLength={500}
        placeholderTextColor={Colors.text.secondary}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          isButtonDisabled && styles.disabledSendButton,
        ]}
        onPress={onSend}
        disabled={isButtonDisabled}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialIcons name="send" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text.primary,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendButton: {
    backgroundColor: Colors.primary + '60', // 60% opacity
  },
});
