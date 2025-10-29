'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Square, Upload, ImageIcon, X } from 'lucide-react';
import { ChatMessages } from './chat-messages';
import { LoadingState } from './loading-state';
import { ErrorState } from './error-state';
import { useSession } from './session-context';

type ViewState = 'chat' | 'loading' | 'error-global' | 'error-ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: Array<{ data: string; mimeType: string; originalName: string }>;
}

interface SelectedImage {
  file: File;
  preview: string;
}

export function ChatArea() {
  const { selectedSessionId } = useSession();
  const [viewState, setViewState] = useState<ViewState>('chat');
  const [errorMessage, setErrorMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
  const MAX_IMAGES = 10;

  // Fetch messages when session changes
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/sessions/${selectedSessionId}/messages`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();
        const formattedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          images: msg.metadata?.images || undefined,
        }));
        setMessages(formattedMessages);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load messages');
        setViewState('error-global');
      }
    };

    fetchMessages();
  }, [selectedSessionId]);

  const handleSendMessage = async () => {
    if (!selectedSessionId || (!inputValue.trim() && selectedImages.length === 0) || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Convert selected images to base64
    const imagePromises = selectedImages.map((selected) => {
      return new Promise<{ data: string; mimeType: string; originalName: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data: prefix
          resolve({
            data: base64,
            mimeType: selected.file.type,
            originalName: selected.file.name,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(selected.file);
      });
    });

    const encodedImages = await Promise.all(imagePromises);

    // Add user message immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage || '(Image only)',
      timestamp: new Date(),
      images: encodedImages.length > 0 ? encodedImages : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSelectedImages([]); // Clear selected images

    // Create assistant message placeholder
    const assistantMsgId = `temp-assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsStreaming(true);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/sessions/${selectedSessionId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage || '',
          images: encodedImages.length > 0 ? encodedImages : undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to stream response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsStreaming(false);
              // Fetch updated messages to get the real IDs
              const res = await fetch(`/api/sessions/${selectedSessionId}/messages`, { cache: 'no-store' });
              if (res.ok) {
                const data = await res.json();
                const formattedMessages: Message[] = data.map((msg: any) => ({
                  id: msg.id,
                  role: msg.role as 'user' | 'assistant',
                  content: msg.content,
                  timestamp: new Date(msg.createdAt),
                  images: msg.metadata?.images || undefined,
                }));
                setMessages(formattedMessages);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, content: msg.content + parsed.content } : msg)));
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled, remove the assistant message
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId));
      } else {
        setErrorMessage(error.message || 'Failed to send message');
        setViewState('error-ai');
        // Remove the assistant message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleInterrupt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleUpload = (type: 'image' | 'csv') => {
    if (type === 'image') {
      fileInputRef.current?.click();
    }
    // CSV upload handled elsewhere
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (selectedImages.length + files.length > MAX_IMAGES) {
      setErrorMessage(`Maximum ${MAX_IMAGES} images allowed`);
      setViewState('error-global');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const validFiles: SelectedImage[] = [];
    const errors: string[] = [];

    // Process all files
    const filePromises = files.map(
      (file) =>
        new Promise<SelectedImage | null>((resolve) => {
          if (!allowedTypes.includes(file.type)) {
            errors.push(`Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, GIF`);
            resolve(null);
            return;
          }

          if (file.size > MAX_IMAGE_SIZE) {
            errors.push(`Image ${file.name} exceeds 4MB limit`);
            resolve(null);
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              file,
              preview: reader.result as string,
            });
          };
          reader.onerror = () => {
            errors.push(`Failed to read ${file.name}`);
            resolve(null);
          };
          reader.readAsDataURL(file);
        })
    );

    const results = await Promise.all(filePromises);
    const valid = results.filter((r): r is SelectedImage => r !== null);

    if (valid.length > 0) {
      setSelectedImages((prev) => [...prev, ...valid]);
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join('; '));
      setViewState('error-global');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Project Analysis</h2>
          <p className="text-sm text-muted-foreground">{selectedSessionId ? 'Active session' : 'No session selected'}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ImageIcon size={20} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewState === 'chat' && <ChatMessages messages={messages} />}
        {viewState === 'loading' && <LoadingState />}
        {viewState === 'error-global' && <ErrorState type="global" message={errorMessage} />}
        {viewState === 'error-ai' && <ErrorState type="ai" message={errorMessage} />}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Image Previews */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-background rounded-lg border border-border">
              {selectedImages.map((selected, index) => (
                <div key={index} className="relative group">
                  <img src={selected.preview} alt={selected.file.name} className="w-20 h-20 object-cover rounded-lg border border-border" />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 bg-error text-error-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[80px] truncate">{selected.file.name}</p>
                </div>
              ))}
            </div>
          )}

          {/* Upload Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleUpload('image')}
              disabled={!selectedSessionId || isStreaming || selectedImages.length >= MAX_IMAGES}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background hover:bg-background/80 border border-border text-sm text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ImageIcon size={16} />
              Upload Image {selectedImages.length > 0 && `(${selectedImages.length}/${MAX_IMAGES})`}
            </button>
          </div>

          {/* Input Field */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedSessionId ? 'Type your message here...' : 'Select a session to start chatting'}
              disabled={!selectedSessionId || isStreaming}
              className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSendMessage}
              disabled={!selectedSessionId || (!inputValue.trim() && selectedImages.length === 0) || isStreaming}
              className="px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
              <span className="hidden sm:inline">Send</span>
            </button>
            <button
              onClick={handleInterrupt}
              disabled={!isStreaming}
              className="px-4 py-3 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square size={18} />
              <span className="hidden sm:inline">Stop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
