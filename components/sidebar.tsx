"use client"

import { Plus, Trash2, Menu, X } from "lucide-react"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const sessions = [
    { id: 1, name: "Project Analysis", date: "Today" },
    { id: 2, name: "Data Processing", date: "Yesterday" },
    { id: 3, name: "Image Recognition", date: "2 days ago" },
  ]

  const resources = [
    { id: 1, name: "sales_data.csv", type: "csv" },
    { id: 2, name: "report_2024.csv", type: "csv" },
  ]

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } fixed md:relative md:translate-x-0 w-64 h-screen bg-muted border-r border-border flex flex-col transition-transform duration-300 z-40`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">AI Chat</h1>
        </div>

        {/* New Session Button */}
        <div className="p-4 border-b border-border">
          <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg transition-colors font-medium">
            <Plus size={18} />
            New Session
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Sessions</h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 rounded-lg bg-background hover:bg-background/80 cursor-pointer transition-colors group"
                >
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
  )
}
