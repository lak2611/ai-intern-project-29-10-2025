'use client';

import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mock messages for UI demonstration
  const messages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Can you analyze the sales data from the CSV file I uploaded?',
      timestamp: new Date(Date.now() - 5 * 60000),
    },
    {
      id: '2',
      role: 'assistant',
      content:
        "I've analyzed your sales data. Here are the key insights:\n\n• Total revenue: $125,000\n• Average transaction: $450\n• Top performing region: North America\n• Growth rate: 15% month-over-month",
      timestamp: new Date(Date.now() - 4 * 60000),
    },
    {
      id: '3',
      role: 'user',
      content: 'What about the image I uploaded? Can you extract text from it?',
      timestamp: new Date(Date.now() - 2 * 60000),
    },
    {
      id: '4',
      role: 'assistant',
      content:
        "Yes, I've extracted the text from your image. It contains a quarterly report with the following sections:\n\n1. Executive Summary\n2. Financial Overview\n3. Market Analysis\n4. Recommendations",
      timestamp: new Date(Date.now() - 1 * 60000),
    },
    {
      id: '5',
      role: 'user',
      content: 'What is the weather in Tokyo?',
      timestamp: new Date(Date.now()),
    },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
