import { useState } from 'react';
import {
  Download,
  PlusSquare,
  RefreshCw,
  Share,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { sounds } from '../audio/soundEngine';
import { applySwUpdate, promptNativeInstall } from './pwaManager';
import { usePwaStore } from './pwaStore';

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const canInstall = usePwaStore((s) => s.canInstall);
  const isInstalled = usePwaStore((s) => s.isInstalled);
  const isIOS = usePwaStore((s) => s.isIOS);

  if (isInstalled || (!canInstall && !isIOS)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        sounds.playUiClick();
        void promptNativeInstall();
      }}
      className={
        compact
          ? 'flex items-center gap-1.5 px-2.5 py-2 sm:tall:py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/55 hover:border-cyan-300 text-cyan-200 hover:text-white text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer'
          : 'flex items-center justify-center gap-2 px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-100 text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer clip-chamfer glow-cyan'
      }
      title="Install AEROSTRIKE as a native fullscreen app"
      aria-label="Install App"
    >
      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 shrink-0" />
      <span className={compact ? 'hidden sm:inline' : ''}>Install App</span>
    </button>
  );
}

export function PwaOfflinePill() {
  const isOnline = usePwaStore((s) => s.isOnline);
  if (isOnline) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/85 border border-amber-400/60 text-amber-200 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer">
      <WifiOff className="w-3 h-3 text-amber-300 shrink-0" />
      <span>Offline • Solo Ready</span>
    </div>
  );
}

export function PwaUpdateBanner() {
  const swUpdateReady = usePwaStore((s) => s.swUpdateReady);
  const [dismissed, setDismissed] = useState(false);

  if (!swUpdateReady || dismissed) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,420px)] safe-insets pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="cyber-panel clip-chamfer px-3.5 py-2.5 border border-cyan-400/65 glow-cyan flex items-center justify-between gap-2.5 shadow-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-mono font-black uppercase tracking-wider text-white truncate">
              New Tactical Build Ready
            </div>
            <div className="text-[10px] font-mono text-cyan-200/80 truncate">
              Reload to apply latest offline assets
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              applySwUpdate();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-mono font-black text-[10px] uppercase tracking-wider clip-chamfer cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Update</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss update banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function IOSInstallModal() {
  const show = usePwaStore((s) => s.showIOSGuideModal);
  const setShow = usePwaStore((s) => s.setShowIOSGuideModal);

  if (!show) return null;

  const handleClose = () => {
    sounds.playUiClick();
    setShow(false);
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 select-none animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg max-w-md w-full border border-cyan-500/50 glow-cyan shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider font-mono text-white">
              Install on iPhone / iPad
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-400 clip-chamfer cursor-pointer"
            aria-label="Close iOS Install Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 bg-slate-950/65">
          <p className="text-xs text-slate-300 leading-relaxed">
            Install <strong className="text-white">AEROSTRIKE: OMEGA</strong> to your Home Screen for edge-to-edge fullscreen combat, custom app icon, and offline Solo Skirmish support.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2.5 bg-slate-900/80 border border-slate-800 clip-chamfer">
              <div className="w-8 h-8 rounded-md bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shrink-0">
                <Share className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="text-xs text-slate-200">
                <span className="font-mono font-bold text-cyan-300 block text-[10px] uppercase">
                  Step 1
                </span>
                Tap the <strong className="text-white">Share</strong> button in Safari&apos;s toolbar.
              </div>
            </div>

            <div className="flex items-center gap-3 p-2.5 bg-slate-900/80 border border-slate-800 clip-chamfer">
              <div className="w-8 h-8 rounded-md bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shrink-0">
                <PlusSquare className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="text-xs text-slate-200">
                <span className="font-mono font-bold text-cyan-300 block text-[10px] uppercase">
                  Step 2
                </span>
                Scroll down and select <strong className="text-white">Add to Home Screen</strong>.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-wider clip-chamfer cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
