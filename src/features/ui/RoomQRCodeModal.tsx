import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode, Sparkles, Smartphone } from 'lucide-react';
import { sounds } from '../audio/soundEngine';

interface RoomQRCodeModalProps {
  isOpen: boolean;
  roomCode: string;
  onClose: () => void;
}

export function RoomQRCodeModal({ isOpen, roomCode, onClose }: RoomQRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
      : `?room=${roomCode}`;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, inviteUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#060913',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    }).catch((err) => {
      console.error('[QRCode] Failed to render:', err);
    });
  }, [isOpen, inviteUrl]);

  if (!isOpen) return null;

  const handleClose = () => {
    sounds.playUiClick();
    onClose();
  };

  const handleCopy = () => {
    sounds.playUiClick();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(inviteUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          // ignore clipboard permission rejections
        });
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-sm sm:max-w-lg max-h-[92dvh] overflow-hidden flex flex-col border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
      >
        {/* Pinned Header (Always visible on mobile portrait & landscape) */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
              Squad Uplink QR
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close QR Modal"
            className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-1.5 bg-slate-900/90 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/60 transition cursor-pointer text-[10px] font-mono font-bold uppercase clip-chamfer"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close</span>
          </button>
        </div>

        {/* Scrollable Body (Adapts side-by-side on mobile landscape / wide screens) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-slate-950/60">
          <div className="min-h-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
            {/* QR Code Canvas in Frame */}
            <div className="relative p-2.5 bg-white rounded-2xl shadow-2xl border-2 border-cyan-400/80 glow-cyan shrink-0">
              <canvas
                ref={canvasRef}
                className="block rounded-lg w-40 h-40 sm:w-44 sm:h-44"
                width={240}
                height={240}
              />
            </div>

            {/* Room Info + Actions */}
            <div className="flex-1 w-full flex flex-col items-center sm:items-start text-center sm:text-left gap-3 min-w-0">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block">
                  Direct Staging Transmission
                </span>
                <div className="text-xl font-black text-white font-mono tracking-widest mt-0.5">
                  {roomCode}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 hidden sm:block" />
                <span>Scan with phone camera or in-game scanner to join room instantly.</span>
              </div>

              <div className="w-full flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono font-bold text-xs uppercase tracking-wider clip-chamfer shadow-lg transition cursor-pointer flex items-center justify-center gap-2 glow-cyan"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-cyan-100" />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2 px-4 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-mono font-bold text-xs uppercase tracking-wider clip-chamfer transition cursor-pointer sm:hidden"
                >
                  Done / Close
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Compact Footer */}
        <div className="shrink-0 px-4 py-2 bg-slate-950/90 border-t border-cyan-500/20 text-center text-[9px] font-mono text-slate-500">
          <Sparkles className="w-2.5 h-2.5 inline mr-1 text-cyan-400" />
          PEERJS DIRECT WEBRTC P2P • TAP OUTSIDE OR CLOSE TO EXIT
        </div>
      </div>
    </div>
  );
}
