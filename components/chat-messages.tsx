'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/lib/types/message';

interface ChatMessagesProps {
  messages: Message[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-muted-foreground text-center">No messages yet. Start a conversation by sending a message.</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full max-h-[calc(100vh-220px)]">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-md lg:max-w-2xl px-4 py-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-none'
                : 'bg-muted text-foreground rounded-bl-none border border-border'
            }`}
          >
            {message.images && message.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {message.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={img.originalName || 'Image'}
                    className="rounded-lg max-w-full h-auto max-h-48 object-cover border border-border/50"
                  />
                ))}
              </div>
            )}
            {message.role === 'assistant' ? (
              <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-headings:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-0 [&_code]:before:content-none [&_code]:after:content-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }: any) {
                      // Block code has className with 'language-', inline code doesn't
                      const isInline = !className || !className.includes('language-');
                      if (isInline) {
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded bg-muted/80 text-foreground font-mono text-xs font-medium border border-border/50 before:content-none after:content-none"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      // Block code styling is handled by pre element
                      return (
                        <code className="block p-0 bg-transparent text-sm font-mono before:content-none after:content-none" {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre({ children, ...props }: any) {
                      return (
                        <pre
                          className="p-4 rounded-lg bg-muted/80 border border-border/50 overflow-x-auto text-sm font-mono leading-relaxed my-3 shadow-sm"
                          {...props}
                        >
                          {children}
                        </pre>
                      );
                    },
                  }}
                >
                  {message.content || '...'}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{message.content || '...'}</p>
            )}
            <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
