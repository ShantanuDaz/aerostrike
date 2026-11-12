import { useEffect, useState } from 'react';
import {
  Check,
  Gamepad2,
  Headphones,
  Monitor,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { sounds } from '../../audio/soundEngine';
import { music, type MusicTrackId } from '../../audio/musicEngine';
import { useAvatarStore } from '../../avatar/avatarStore';
import { useSettingsStore, type SettingsTab } from '../../settings/settingsStore';
import { networkManager } from '../../network/peerRoom';
import { PilotAvatarTab } from '../settings/PilotAvatarTab';
import { AudioSettingsTab } from '../settings/AudioSettingsTab';
import { DisplayHudTab } from '../settings/DisplayHudTab';
import { ControlsIntelTab } from '../settings/ControlsIntelTab';

interface WarRoomArmoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'avatar', label: 'Pilot & Suit', icon: User },
  { id: 'controls', label: 'Controls', icon: Gamepad2 },
  { id: 'display', label: 'Display & HUD', icon: Monitor },
  { id: 'audio', label: 'Audio', icon: Headphones },
];

export function WarRoomArmoryModal({
  isOpen,
  onClose,
}: WarRoomArmoryModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('avatar');
  const [previewingTrack, setPreviewingTrack] = useState<MusicTrackId | null>(null);
  const avatar = useAvatarStore((s) => s.avatar);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // Debounced live avatar broadcast to War Room squadmates while open
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      networkManager.broadcastAvatarChange();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isOpen, avatar]);

  useEffect(() => {
    if (!isOpen) {
      music.setPreviewTrack(null);
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        music.setPreviewTrack(null);
        networkManager.broadcastAvatarChange();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      music.setPreviewTrack(null);
    };
  }, [isOpen, onClose]);

  const effectivePreviewTrack = isOpen ? previewingTrack : null;

  if (!isOpen) return null;

  const handleClose = () => {
    sounds.playUiClick();
    music.setPreviewTrack(null);
    setPreviewingTrack(null);
    networkManager.broadcastAvatarChange();
    onClose();
  };

  const handleToggleTrackPreview = (trackId: MusicTrackId) => {
    sounds.playUiClick();
    if (previewingTrack === trackId) {
      setPreviewingTrack(null);
      music.setPreviewTrack(null);
    } else {
      if (!musicEnabled) {
        updateSettings({ musicEnabled: true });
      }
      setPreviewingTrack(trackId);
      music.setPreviewTrack(trackId);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 safe-insets flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cyber-panel clip-chamfer-lg shadow-2xl w-full max-w-5xl h-[94dvh] sm:h-[88dvh] flex flex-col overflow-hidden border border-cyan-500/50 glow-cyan animate-in zoom-in-95 duration-150"
      >
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b border-cyan-500/20 bg-slate-950/90">
          <div className="flex items-center gap-2 min-w-0">
            <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-wider uppercase font-mono truncate">
                War Room Armory &amp; Settings
              </h3>
              <span className="hidden sm:block text-[9px] font-mono text-emerald-400 uppercase truncate">
                Suit &amp; weapon changes sync live to squadmates
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase clip-chamfer">
              <Check className="w-3 h-3" /> Synced
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-white text-[10px] font-mono font-bold uppercase clip-chamfer cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-cyan-400" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="shrink-0 grid grid-cols-4 gap-1 sm:gap-1.5 px-2.5 sm:px-5 py-1.5 sm:py-2 bg-slate-950/80 border-b border-slate-800">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  if (tab.id !== 'audio' && previewingTrack) {
                    setPreviewingTrack(null);
                    music.setPreviewTrack(null);
                  }
                  setActiveTab(tab.id);
                }}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1.5 sm:py-2 text-[9.5px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500'}`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-2.5 sm:p-4 bg-slate-950/60">
          {activeTab === 'avatar' && <PilotAvatarTab />}
          {activeTab === 'display' && <DisplayHudTab />}
          {activeTab === 'audio' && (
            <AudioSettingsTab
              previewingTrack={effectivePreviewTrack}
              onToggleTrackPreview={handleToggleTrackPreview}
              onStopTrackPreview={() => setPreviewingTrack(null)}
            />
          )}
          {activeTab === 'controls' && <ControlsIntelTab />}
        </div>
      </div>
    </div>
  );
}
