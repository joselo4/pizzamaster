import React from 'react';

type Props = { children: React.ReactNode; title?: string };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    try { console.error('[ErrorBoundary]', error); } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bg-white border border-red-200 rounded p-4">
        <div className="font-bold text-red-700">{this.props.title || 'Error en este módulo'}</div>
        <pre className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
      </div>
    );
  }
}
