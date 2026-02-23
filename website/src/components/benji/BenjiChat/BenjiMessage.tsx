'use client';

import { motion } from 'framer-motion';
import { User, Bot, Clock, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { ChatAttachment } from './BenjiChat';

export interface BenjiMessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  confidence?: number;
  suggestions?: string[];
  attachments?: ChatAttachment[];
  onSuggestionClick?: (suggestion: string) => void;
}

export const BenjiMessage = ({ 
  content, 
  role, 
  timestamp, 
  confidence,
  suggestions,
  attachments,
  onSuggestionClick 
}: BenjiMessageProps) => {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start space-x-3 mb-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-gray-500'
            : 'bg-blue-500'
        }`}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div
          className={`rounded-md px-4 py-3 max-w-[80%] ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-white border border-gray-200 text-gray-800'
          }`}
        >
          {/* Attachments */}
          {attachments && attachments.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {attachments.map((att, idx) => (
                <a
                  key={idx}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 rounded-md p-2 text-xs transition-colors ${
                    isUser
                      ? 'bg-blue-400/30 hover:bg-blue-400/50 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {att.type.startsWith('image/') ? (
                    <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1">{att.name}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                </a>
              ))}
              {/* Inline image preview for image attachments */}
              {attachments.filter(a => a.type.startsWith('image/')).map((att, idx) => (
                <img
                  key={`preview-${idx}`}
                  src={att.url}
                  alt={att.name}
                  className="rounded-md max-w-full max-h-40 object-cover mt-1"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          
          {/* Confidence Score (Benji only) */}
          {!isUser && confidence && (
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className="mr-1">Confidence:</span>
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="ml-1">{Math.round(confidence * 100)}%</span>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {!isUser && suggestions && suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="px-3 py-1.5 text-xs bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center mt-1 text-xs text-gray-400">
          <Clock className="w-3 h-3 mr-1" />
          {format(timestamp, 'h:mm a')}
        </div>
      </div>
    </motion.div>
  );
};
