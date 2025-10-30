'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Menu, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'react-toastify';
import { Session } from '@prisma/client';
import { useSession } from './session-context';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { selectedSessionId, setSelectedSessionId } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resources, setResources] = useState<
    Array<{ id: string; sessionId: string; originalName: string; storedPath: string; mimeType: string; sizeBytes: number; createdAt: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isUploadingFromUrl, setIsUploadingFromUrl] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    const loadResources = async () => {
      if (!selectedSessionId) return;
      try {
        setResourcesLoading(true);
        const res = await fetch(`/api/sessions/${selectedSessionId}/resources`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load resources');
        const data = await res.json();
        setResources(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load resources');
      } finally {
        setResourcesLoading(false);
      }
    };
    loadResources();
  }, [selectedSessionId]);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSessionName('');
  };

  const handleCreateSession = async () => {
    if (!sessionName.trim()) return;
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const created = await res.json();
      setSessions((prev) => [created, ...prev]);
      setSelectedSessionId(created.id); // Auto-select the newly created session
      handleCloseDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateSession();
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!id) {
      toast.error('Invalid session id');
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete session');
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = async () => {
      if (!input.files || input.files.length === 0 || !selectedSessionId) return;
      const file = input.files[0];
      if (file.size > Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_BYTES || 20 * 1024 * 1024)) {
        toast.error('File too large');
        return;
      }
      const form = new FormData();
      form.append('file', file);
      try {
        setIsUploading(true);
        const res = await fetch(`/api/sessions/${selectedSessionId}/resources`, { method: 'POST', body: form });
        if (!res.ok) throw new Error('Failed to upload');
        const created = await res.json();
        setResources((prev) => [created, ...prev]);
        toast.success('Uploaded');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!selectedSessionId) return;
    try {
      const res = await fetch(`/api/sessions/${selectedSessionId}/resources/${resourceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete resource');
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete resource');
    }
  };

  const handleUploadFromUrl = async () => {
    if (!selectedSessionId || !urlInput.trim()) return;
    try {
      setIsUploadingFromUrl(true);
      const res = await fetch(`/api/sessions/${selectedSessionId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload from URL');
      }
      const created = await res.json();
      setResources((prev) => [created, ...prev]);
      setUrlInput('');
      setShowUrlInput(false);
      toast.success('Uploaded from URL');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload from URL failed');
    } finally {
      setIsUploadingFromUrl(false);
    }
  };

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
                      disabled={!sessionName.trim() || isSubmitting}
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Creating...' : 'Create'}
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
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions yet</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all group relative ${
                      selectedSessionId === session.id
                        ? 'bg-primary/10 border-l-4 border-primary'
                        : 'bg-background hover:bg-background/80 border-l-4 border-transparent'
                    }`}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${selectedSessionId === session.id ? 'text-primary' : 'text-foreground'}`}>
                          {session.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleString()}</p>
                      </div>
                      <button
                        aria-label="Delete session"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <Trash2 size={16} className="text-error" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resources Box */}
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase">Resources</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={!selectedSessionId}
                className="text-xs px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Toggle URL input"
              >
                {showUrlInput ? 'Cancel' : 'From URL'}
              </button>
              <button
                onClick={handleUploadClick}
                disabled={!selectedSessionId || isUploading}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Upload CSV"
              >
                {isUploading ? 'Uploading…' : 'Add CSV'}
              </button>
            </div>
          </div>
          {showUrlInput && (
            <div className="mb-3 space-y-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/data.csv"
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUploadFromUrl();
                  }
                }}
              />
              <button
                onClick={handleUploadFromUrl}
                disabled={!selectedSessionId || !urlInput.trim() || isUploadingFromUrl}
                className="w-full text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingFromUrl ? 'Uploading…' : 'Upload from URL'}
              </button>
            </div>
          )}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {!selectedSessionId ? (
              <p className="text-xs text-muted-foreground text-center py-2">Select a session</p>
            ) : resourcesLoading ? (
              <p className="text-xs text-muted-foreground text-center py-2">Loading…</p>
            ) : resources.length > 0 ? (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="p-2 rounded bg-background flex items-center justify-between group hover:bg-background/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{resource.originalName}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(resource.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={selectedSessionId ? `/api/sessions/${selectedSessionId}/resources/${resource.id}/download` : '#'}
                      className="text-xs px-2 py-1 rounded hover:bg-muted"
                      aria-label="Download resource"
                    >
                      Download
                    </a>
                    <button
                      className="opacity-100 p-1 hover:bg-muted rounded transition-all"
                      onClick={() => handleDeleteResource(resource.id)}
                      aria-label="Delete resource"
                    >
                      <Trash2 size={14} className="text-error" />
                    </button>
                  </div>
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
