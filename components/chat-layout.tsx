'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { ChatArea } from './chat-area';
import { SessionProvider } from './session-context';

export function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SessionProvider>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Chat Area */}
        <ChatArea />
      </div>
    </SessionProvider>
  );
}
