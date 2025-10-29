"use client"

import { AlertCircle, RefreshCw } from "lucide-react"

interface ErrorStateProps {
  type: "global" | "ai"
  message?: string
}

export function ErrorState({ type, message }: ErrorStateProps) {
  const isGlobalError = type === "global"

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className={`p-4 rounded-full ${isGlobalError ? "bg-error/20" : "bg-warning/20"}`}>
            <AlertCircle size={32} className={isGlobalError ? "text-error" : "text-warning"} />
          </div>
        </div>

        {/* Error Content */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {isGlobalError ? "System Error" : "AI Processing Error"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {message ||
              (isGlobalError
                ? "An unexpected error occurred. Please try again later."
                : "The AI encountered an issue processing your request. Please try again.")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium">
            <RefreshCw size={16} />
            Retry
          </button>
          <button className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors font-medium border border-border">
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
