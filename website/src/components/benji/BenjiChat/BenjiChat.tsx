'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Sparkles, Minimize2, Maximize2, Paperclip, FileText, Image as ImageIcon, XCircle } from 'lucide-react';
import { BenjiMessage, BenjiMessageProps } from './BenjiMessage';
import { BenjiTypingIndicator } from './BenjiTypingIndicator';
import { aiService } from '@/services/aiService';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import toast from 'react-hot-toast';

const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface BenjiChatProps {
  context?: 'dashboard' | 'shipment' | 'tracking' | 'profile';
  shipmentId?: string;
  userId?: string;
  userType?: 'client' | 'driver' | 'admin' | 'broker';
}

export const BenjiChat = ({ 
  context = 'dashboard',
  shipmentId,
  userId,
  userType = 'client'
}: BenjiChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<BenjiMessageProps[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: BenjiMessageProps = {
        id: 'welcome',
        role: 'assistant',
        content: getWelcomeMessage(),
        timestamp: new Date(),
        confidence: 1,
        suggestions: getContextSuggestions(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  const getWelcomeMessage = () => {
    switch (userType) {
      case 'driver':
        return "👋 Hey! I'm Benji, your driving companion. Need help finding the best loads or optimizing your route?";
      case 'admin':
        return "👋 Hi! I'm Benji, your AI assistant. I can help with dispatching, support tickets, or analytics.";
      case 'broker':
        return "👋 Hello! I'm Benji. Need help with bulk uploads, integrations, or carrier matching?";
      default:
        return "👋 Hi! I'm Benji, your AI shipping assistant. How can I help you today?";
    }
  };

  const getContextSuggestions = () => {
    if (shipmentId) {
      return [
        "Where is my vehicle?",
        "Update delivery time",
        "Contact my driver",
      ];
    }

    switch (userType) {
      case 'driver':
        return [
          "Show me best loads",
          "Optimize my route",
          "Help with paperwork",
        ];
      case 'admin':
        return [
          "Auto-assign loads",
          "Show urgent tickets",
          "Today's performance",
        ];
      case 'broker':
        return [
          "Upload vehicles",
          "Match carriers",
          "Revenue report",
        ];
      default:
        return [
          "Create a shipment",
          "Track my vehicles",
          "Get a quote",
        ];
    }
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;

    const currentAttachments = [...attachments];
    const messageContent = inputValue.trim() || (currentAttachments.length > 0 ? `[Attached: ${currentAttachments.map(a => a.name).join(', ')}]` : '');

    const userMessage: BenjiMessageProps = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAttachments([]);
    setIsLoading(true);

    try {
      // Call real backend API
      const chatMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      chatMessages.push({ role: 'user' as const, content: messageContent });

      const response = await aiService.chat(chatMessages, {
        userType,
        currentPage: context,
        shipmentId,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      });

      const aiResponse: BenjiMessageProps = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        confidence: response.confidence,
        suggestions: response.suggestions,
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Chat error:', error);
      
      // Fallback response on error
      const fallbackResponse: BenjiMessageProps = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment, or contact support if this persists.",
        timestamp: new Date(),
        confidence: 0.5,
      };
      
      setMessages(prev => [...prev, fallbackResponse]);
      toast.error('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Please upload images, PDFs, CSVs, or text files.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    setIsUploading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = `benji-attachments/${userType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const attachment: ChatAttachment = {
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      };

      setAttachments(prev => [...prev, attachment]);
      toast.success(`${file.name} attached`);
    } catch (err: any) {
      console.error('File upload error:', err);
      toast.error('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-blue-500 rounded-full border border-gray-200 flex items-center justify-center z-50"
          >
            <Bot className="w-7 h-7 text-white" />
            <motion.div
              className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-3 h-3 text-white m-1" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '72px' : '600px'
            }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-6 right-6 w-[400px] bg-white rounded-3xl z-50 flex flex-col overflow-hidden border border-gray-200"
          >
            {/* Header */}
            <div className="bg-blue-500 px-4 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Benji</h3>
                  <p className="text-white/80 text-xs">AI Shipping Assistant</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white/80 hover:text-white transition-colors p-2"
                >
                  {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                  {messages.map((message) => (
                    <BenjiMessage
                      key={message.id}
                      {...message}
                      onSuggestionClick={handleSuggestionClick}
                    />
                  ))}
                  {isLoading && <BenjiTypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-gray-200 p-4 bg-white">
                  {/* Attachment Previews */}
                  {attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          {att.type.startsWith('image/') ? (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          )}
                          <span className="text-blue-800 max-w-[120px] truncate">{att.name}</span>
                          <span className="text-blue-500">({formatFileSize(att.size)})</span>
                          <button
                            onClick={() => removeAttachment(idx)}
                            className="text-blue-400 hover:text-red-500 transition-colors ml-0.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="mb-2 flex items-center gap-2 text-xs text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Uploading file...
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_FILE_TYPES.join(',')}
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* Attachment button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isUploading}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-gray-100"
                      title="Attach file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder={attachments.length > 0 ? 'Add a message or send...' : 'Ask Benji anything...'}
                      disabled={isLoading}
                      className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
                      className="w-8 h-8 bg-blue-500 rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Benji is powered by AI · Supports images, PDFs &amp; CSV attachments
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
