import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl bg-surface-card/40 border border-surface-border/30 p-4 flex items-center justify-center" style={{ height: 400 }}>
          <div className="text-center">
            <p className="text-sm text-red-400 font-semibold">Something went wrong</p>
            <p className="text-xs text-ink-muted mt-1">Check console for details. Click "Start Forecast" to retry.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
