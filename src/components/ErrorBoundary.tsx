import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark text-white grid place-items-center px-4">
          <div className="max-w-lg w-full rounded-3xl bg-card border border-white/10 p-6">
            <div className="text-2xl font-black">Ocurrió un error</div>
            <p className="mt-2 text-white/70">Refresca la página. Si continúa, revisa la configuración.</p>
            <div className="mt-5 flex gap-3 flex-wrap">
              <button onClick={() => location.reload()} className="rounded-2xl bg-orange-500 hover:bg-orange-600 px-4 py-2 font-extrabold">Refrescar</button>
              <a href="/promo" className="rounded-2xl bg-white/10 hover:bg-white/15 px-4 py-2 font-extrabold">Ir a /promo</a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
