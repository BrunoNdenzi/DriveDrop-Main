'use client';

import { motion } from 'framer-motion';
import { User, Bot, Clock } from 'lucide-react';
import { format } from 'date-fns';

export interface BenjiMessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  confidence?: number;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export const BenjiMessage = ({ 
  content, 
  role, 
  timestamp, 
  confidence,
  suggestions,
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
            ? 'bg-gradient-to-br from-gray-400 to-gray-600'
            : 'bg-gradient-to-br from-teal-500 to-purple-600'
        } shadow-lg`}
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
          className={`rounded-2xl px-4 py-3 max-w-[80%] ${
            isUser
              ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white'
              : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          
          {/* Confidence Score (Benji only) */}
          {!isUser && confidence && (
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <span className="mr-1">Confidence:</span>
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-purple-600"
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
                className="px-3 py-1.5 text-xs bg-white border border-teal-200 text-teal-700 rounded-full hover:bg-teal-50 hover:border-teal-300 transition-all shadow-sm"
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
