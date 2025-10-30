'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface SessionContextType {
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  console.log('🚀 ~ SessionProvider ~ selectedSessionId:', selectedSessionId);

  return <SessionContext.Provider value={{ selectedSessionId, setSelectedSessionId }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
