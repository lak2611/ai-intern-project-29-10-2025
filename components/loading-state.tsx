"use client"

export function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        {/* Spinner */}
        <div className="flex justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-border"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin"></div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Processing your request</p>
          <p className="text-sm text-muted-foreground">Please wait while AI generates a response...</p>
        </div>

        {/* Skeleton Messages */}
        <div className="mt-8 space-y-4 max-w-md">
          <div className="flex justify-start">
            <div className="space-y-2 w-64">
              <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-4/6 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
