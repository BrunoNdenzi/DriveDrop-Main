import React from 'react';
import { Message } from '../types/MessageTypes';

interface MessageItemProps {
  message: Message;
  isFromMe: boolean;
}

export declare const MessageItem: React.FC<MessageItemProps>;
