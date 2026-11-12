import { Suspense, lazy, useEffect, useState } from 'react';
import type React from 'react';
import { LogIn, Scan, X } from 'lucide-react';
import { sounds } from '../../audio/soundEngine';

const QRScannerModal = lazy(() =>
  import('../../ui/QRScannerModal').then((m) => ({ default: m.QRScannerModal })),
);

interface JoinSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoomCode: (roomCode: string) => void;
}

export function JoinSquadModal({ isOpen, onClose, onJoinRoomCode }: JoinSquadModalProps) {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!isOpen || showQRScanner) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, showQRScanner, onClose]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) return;
    sounds.playUiClick();
    onJoinRoomCode(cleanCode);
  };

  const handleScanSuccess = (scannedCode: string) => {
    setJoinCode(scannedCode);
    setShowQRScanner(false);
    onJoinRoomCode(scannedCode);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="cyber-panel clip-chamfer-lg w-full max-w-sm max-h-[92dvh] overflow-y-auto p-5 sm:p-6 border border-cyan-500/40 glow-cyan flex flex-col gap-3.5"
        >
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2">
              <LogIn className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono">
                Join Squad Room
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              setShowQRScanner(true);
            }}
            className="w-full py-3 bg-gradient-to-r from-cyan-900/70 to-blue-900/70 hover:from-cyan-800/80 hover:to-blue-800/80 border border-cyan-400/50 text-cyan-200 hover:text-white font-mono font-bold text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer flex items-center justify-center gap-2 glow-cyan"
          >
            <Scan className="w-4 h-4 text-cyan-400" />
            <span>Scan Room QR Code</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">OR ENTER CODE</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              autoFocus
              placeholder="ROOM-XXXXX"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-700 focus:border-cyan-400 px-4 py-3 text-sm font-mono font-bold text-cyan-200 uppercase text-center tracking-widest outline-none clip-chamfer"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest clip-chamfer transition cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect to Squad</span>
            </button>
          </form>
        </div>
      </div>

      {/* Optical QR Scanner Modal (Lazy-loaded only when opened) */}
      {showQRScanner && (
        <Suspense fallback={null}>
          <QRScannerModal
            isOpen={showQRScanner}
            onClose={() => setShowQRScanner(false)}
            onScanSuccess={handleScanSuccess}
          />
        </Suspense>
      )}
    </>
  );
}
