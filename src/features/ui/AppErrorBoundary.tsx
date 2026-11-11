import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected runtime exception',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught UI error:', error, info.componentStack);
  }

  handleResetAndReload = () => {
    try {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.location.replace(cleanUrl);
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 cyber-grid-bg text-slate-100 select-none">
          <div className="cyber-panel-red rounded-3xl p-6 sm:p-8 max-w-md w-full flex flex-col items-center text-center gap-4 border border-rose-500/60 glow-red">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/90 border border-rose-500/60 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest block">
                // TACTICAL HUD RECOVERY //
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-tight mt-1">
                Uplink Interrupted
              </h2>
              <p className="text-xs text-slate-300 font-mono mt-2 break-words bg-slate-950/70 p-3 rounded-xl border border-rose-500/30">
                {this.state.errorMessage}
              </p>
            </div>

            <button
              onClick={this.handleResetAndReload}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Uplink & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
