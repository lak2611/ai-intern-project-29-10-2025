'use client';

import { useState } from 'react';
import { Plus, Trash2, Menu, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');

  const sessions = [
    { id: 1, name: 'Project Analysis', date: 'Today' },
    { id: 2, name: 'Data Processing', date: 'Yesterday' },
    { id: 3, name: 'Image Recognition', date: '2 days ago' },
  ];

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSessionName('');
  };

  const handleCreateSession = () => {
    if (sessionName.trim()) {
      // TODO: Add session creation logic here
      console.log('Creating session:', sessionName);
      handleCloseDialog();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateSession();
    }
  };

  const resources = [
    { id: 1, name: 'sales_data.csv', type: 'csv' },
    { id: 2, name: 'report_2024.csv', type: 'csv' },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button onClick={onToggle} className="fixed top-4 left-4 z-50 md:hidden p-2 hover:bg-muted rounded-lg transition-colors">
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed md:relative md:translate-x-0 w-64 h-screen bg-muted border-r border-border flex flex-col transition-transform duration-300 z-40`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">AI Chat</h1>
        </div>

        {/* New Session Button */}
        <div className="p-4 border-b border-border">
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg transition-colors font-medium">
                <Plus size={18} />
                New Session
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
              <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg">
                <Dialog.Title className="text-lg font-semibold text-foreground">Create New Session</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mb-4">Enter a name for your new session.</Dialog.Description>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="session-name" className="text-sm font-medium text-foreground">
                      Session Name
                    </label>
                    <input
                      id="session-name"
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g., Project Analysis"
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Dialog.Close asChild>
                      <button
                        onClick={handleCloseDialog}
                        className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      onClick={handleCreateSession}
                      disabled={!sessionName.trim()}
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Sessions</h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="p-3 rounded-lg bg-background hover:bg-background/80 cursor-pointer transition-colors group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground">{session.date}</p>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all">
                      <Trash2 size={16} className="text-error" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resources Box */}
        <div className="border-t border-border p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Resources</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {resources.length > 0 ? (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="p-2 rounded bg-background flex items-center justify-between group hover:bg-background/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{resource.name}</p>
                    <p className="text-xs text-muted-foreground">{resource.type}</p>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all">
                    <Trash2 size={14} className="text-error" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No resources</p>
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/50 md:hidden z-30" onClick={onToggle} />}
    </>
  );
}
