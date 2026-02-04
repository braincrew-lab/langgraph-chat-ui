/**
 * ThreadErrorBoundary - Thread-specific Error Boundary
 *
 * Provides a user-friendly error UI for chat thread failures
 * with options to retry or start a new conversation.
 */

"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle, RefreshCw, MessageSquarePlus } from "lucide-react";

interface Props {
  children: ReactNode;
  onNewConversation?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ThreadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ThreadErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleNewConversation = () => {
    this.setState({ hasError: false, error: null });
    this.props.onNewConversation?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="text-destructive mb-6 h-16 w-16" />
          <h2 className="mb-2 text-xl font-semibold">
            Unable to load conversation
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            There was a problem loading this conversation. This might be due to
            a network issue or invalid data.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={this.handleRetry}
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            {this.props.onNewConversation && (
              <Button onClick={this.handleNewConversation}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                New Conversation
              </Button>
            )}
          </div>
          {this.state.error && (
            <details className="mt-6 w-full max-w-lg text-left">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                Technical details
              </summary>
              <pre className="bg-muted mt-2 overflow-auto rounded-md p-3 text-xs">
                {this.state.error.message}
                {this.state.error.stack && (
                  <>
                    {"\n\n"}
                    {this.state.error.stack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
