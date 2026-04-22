import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { platform } from '@/platform';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Phase 10: route through the platform logger so Tauri builds land in
    // the app's log file (~/Library/Logs/com.voiceround.app/ on macOS) and
    // web builds continue to hit the browser console unchanged.
    //
    // Bound stack + componentStack length. The log file is capped at 1MB
    // with KeepOne rotation; a single pathological stack (Tauri webview
    // + React + minified bundle + source-map) can easily exceed 100KB
    // and flush older diagnostics we'd rather keep. 4KB is plenty to
    // identify the failure site.
    const STACK_LIMIT = 4_000;
    platform.logger.error('ErrorBoundary caught', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.slice(0, STACK_LIMIT) ?? '',
      componentStack: info.componentStack?.slice(0, STACK_LIMIT) ?? '',
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">An unexpected error occurred.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function SessionErrorFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-bold text-foreground">Session encountered an error</h2>
      <p className="text-muted-foreground">Something went wrong during your interview session.</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Return Home
        </Button>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    </div>
  );
}
