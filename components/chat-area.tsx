"use client"

import { useState } from "react"
import { Send, Square, Upload, ImageIcon } from "lucide-react"
import { ChatMessages } from "./chat-messages"
import { LoadingState } from "./loading-state"
import { ErrorState } from "./error-state"

type ViewState = "chat" | "loading" | "error-global" | "error-ai"

export function ChatArea() {
  const [viewState, setViewState] = useState<ViewState>("chat")
  const [errorMessage, setErrorMessage] = useState("")

  const handleSendMessage = () => {
    // UI only - no logic
  }

  const handleInterrupt = () => {
    // UI only - no logic
  }

  const handleUpload = (type: "image" | "csv") => {
    // UI only - no logic
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Project Analysis</h2>
          <p className="text-sm text-muted-foreground">Active session</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ImageIcon size={20} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewState === "chat" && <ChatMessages />}
        {viewState === "loading" && <LoadingState />}
        {viewState === "error-global" && <ErrorState type="global" message={errorMessage} />}
        {viewState === "error-ai" && <ErrorState type="ai" message={errorMessage} />}
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Upload Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleUpload("image")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background hover:bg-background/80 border border-border text-sm text-foreground transition-colors"
            >
              <ImageIcon size={16} />
              Upload Image
            </button>
            <button
              onClick={() => handleUpload("csv")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background hover:bg-background/80 border border-border text-sm text-foreground transition-colors"
            >
              <Upload size={16} />
              Upload CSV
            </button>
          </div>

          {/* Input Field */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type your message here..."
              className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button
              onClick={handleSendMessage}
              className="px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              <Send size={18} />
              <span className="hidden sm:inline">Send</span>
            </button>
            <button
              onClick={handleInterrupt}
              className="px-4 py-3 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              <Square size={18} />
              <span className="hidden sm:inline">Stop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
