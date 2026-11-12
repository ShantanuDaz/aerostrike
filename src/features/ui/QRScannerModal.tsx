import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Scan, Zap, RefreshCw } from 'lucide-react';
import { sounds } from '../audio/soundEngine';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (roomCode: string) => void;
}

function extractRoomCode(rawText: string): string | null {
  const text = rawText.trim();
  // 1. Check if it's a URL with ?room=
  try {
    const url = new URL(text);
    const roomParam = url.searchParams.get('room');
    if (roomParam) return roomParam.trim().toUpperCase();
  } catch {
    // Not a standard absolute URL
  }

  // 2. Regex check for ?room=ROOM-XXXXX
  const paramMatch = text.match(/[?&]room=([a-zA-Z0-9_-]+)/i);
  if (paramMatch && paramMatch[1]) {
    return paramMatch[1].trim().toUpperCase();
  }

  // 3. Raw room code format (e.g. ROOM-XXXXX or 4-16 alphanumeric chars)
  if (/^(ROOM-)?[a-zA-Z0-9_-]{4,16}$/i.test(text)) {
    return text.toUpperCase();
  }

  return null;
}

function QRScannerModalContent({ onClose, onScanSuccess }: { onClose: () => void; onScanSuccess: (roomCode: string) => void }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onScanSuccessRef = useRef(onScanSuccess);

  useEffect(() => {
    onCloseRef.current = onClose;
    onScanSuccessRef.current = onScanSuccess;
  }, [onClose, onScanSuccess]);

  useEffect(() => {
    let mounted = true;
    isStoppingRef.current = false;
    const elementId = 'aerostrike-qr-reader';

    const safeStopAndClear = async (scanner: Html5Qrcode) => {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // html5-qrcode throws synchronously if already stopped or transitioning
      }
      try {
        scanner.clear();
      } catch {
        // ignore if element was already detached by React
      }
    };

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        const config = {
          fps: 15,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0,
        };

        const handleSuccess = (decodedText: string) => {
          if (!mounted || isStoppingRef.current) return;
          const detectedRoom = extractRoomCode(decodedText);

          if (detectedRoom) {
            isStoppingRef.current = true;
            try {
              sounds.playFlagPickup();
            } catch {
              // ignore mobile audio context restrictions
            }

            // Detach ref before stopping so unmount cleanup doesn't double-stop synchronously
            scannerRef.current = null;
            safeStopAndClear(scanner).finally(() => {
              if (!mounted) return;
              onCloseRef.current();
              onScanSuccessRef.current(detectedRoom);
            });
          }
        };

        const handleError = () => {
          // Ignored per-frame decoding misses while aiming camera
        };

        // Attempt 1: Back Camera (mobile)
        try {
          await scanner.start(
            { facingMode: 'environment' },
            config,
            handleSuccess,
            handleError
          );
        } catch (envErr) {
          console.warn('[QRScanner] Environment camera failed, trying default camera:', envErr);
          // Attempt 2: Fallback to any available camera (desktop webcams)
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            await scanner.start(
              cameras[0].id,
              config,
              handleSuccess,
              handleError
            );
          } else {
            throw new Error('No video cameras detected on this device.', { cause: envErr });
          }
        }

        if (!mounted) {
          scannerRef.current = null;
          await safeStopAndClear(scanner);
          return;
        }

        setIsInitializing(false);
      } catch (err) {
        console.error('[QRScanner] Camera start error:', err);
        if (mounted) {
          setIsInitializing(false);
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Could not access device camera. Please check camera permissions in your browser.'
          );
        }
      }
    };

    // Small delay to ensure DOM element is mounted
    const timeout = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      const activeScanner = scannerRef.current;
      scannerRef.current = null;
      if (activeScanner) {
        isStoppingRef.current = true;
        void safeStopAndClear(activeScanner);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-md short-wide:max-w-xl max-h-[94dvh] overflow-hidden flex flex-col border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150 relative"
      >
        {/* Top Header (Pinned) */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-2.5 sm:tall:py-3 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono">
              Tactical QR Scanner
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scanner"
            className="text-slate-300 hover:text-white px-2 py-1 bg-slate-900 border border-slate-700 hover:border-rose-500/60 hover:bg-rose-950/60 transition cursor-pointer flex items-center gap-1 text-[10px] font-mono font-bold uppercase clip-chamfer"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Close</span>
          </button>
        </div>

        {/* Scrollable Video Viewport Container */}
        <div className="flex-1 min-h-0 overflow-y-auto cyber-scroll relative p-4 sm:tall:p-5 short:p-3 bg-[#060913]">
          <div className="min-h-full flex flex-col short-wide:flex-row items-center justify-center gap-4 short:gap-4 relative">
            {/* HTML5 QR Camera Element + Centered Reticle */}
            <div className="relative flex items-center justify-center w-full max-w-[230px] short:max-w-[165px] sm:tall:max-w-[260px] shrink-0">
              <div
                id="aerostrike-qr-reader"
                className="w-full overflow-hidden rounded-2xl border-2 border-cyan-500/40 relative shadow-2xl bg-black"
              />

              {/* Sci-Fi Reticle Overlay (centered directly on viewfinder) */}
              {!errorMessage && (
                <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
                  {/* Corner Brackets */}
                  <div className="flex justify-between">
                    <div className="w-5 h-5 sm:tall:w-6 sm:tall:h-6 border-t-2 border-l-2 border-cyan-400 glow-cyan" />
                    <div className="w-5 h-5 sm:tall:w-6 sm:tall:h-6 border-t-2 border-r-2 border-cyan-400 glow-cyan" />
                  </div>

                  {/* Scanning Laser Beam */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-lg shadow-cyan-400 animate-bounce opacity-90" />

                  <div className="flex justify-between">
                    <div className="w-5 h-5 sm:tall:w-6 sm:tall:h-6 border-b-2 border-l-2 border-cyan-400 glow-cyan" />
                    <div className="w-5 h-5 sm:tall:w-6 sm:tall:h-6 border-b-2 border-r-2 border-cyan-400 glow-cyan" />
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isInitializing && !errorMessage && (
                <div className="absolute inset-0 rounded-2xl bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 p-3 text-center">
                  <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest">
                    INITIALIZING OPTICAL SENSORS...
                  </span>
                </div>
              )}
            </div>

            {/* Camera Error / Permission Denied */}
            {errorMessage && (
              <div className="p-3.5 sm:tall:p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-center flex flex-col items-center gap-2.5 flex-1 min-w-0">
                <AlertCircle className="w-7 h-7 sm:tall:w-8 sm:tall:h-8 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black uppercase text-rose-300 font-mono">
                    Optical Uplink Failed
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed break-words">
                    {errorMessage}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  Tip: You can manually paste the Room Code in the join box.
                </span>
              </div>
            )}

            {/* Instructions */}
            {!errorMessage && (
              <div className="text-center short-wide:text-left short-wide:flex-1 min-w-0">
                <span className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-widest flex items-center justify-center short-wide:justify-start gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> Align Room QR in Reticle
                </span>
                <p className="text-[10px] font-mono text-slate-400 mt-1 leading-relaxed">
                  Automatic optical scan will lock and connect to squad
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pinned Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-2 sm:tall:py-2.5 bg-slate-950/90 border-t border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>CAMERA TARGETING ACTIVE</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  if (!isOpen) return null;
  return <QRScannerModalContent onClose={onClose} onScanSuccess={onScanSuccess} />;
}