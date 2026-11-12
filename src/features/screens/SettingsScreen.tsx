import { useEffect, useState } from 'react';
import { sounds } from '../audio/soundEngine';
import { music, type MusicTrackId } from '../audio/musicEngine';
import { useSettingsStore, type SettingsTab } from '../settings/settingsStore';
import { AudioSettingsTab } from './settings/AudioSettingsTab';
import { ControlsIntelTab } from './settings/ControlsIntelTab';
import { DisplayHudTab } from './settings/DisplayHudTab';
import { PilotAvatarTab } from './settings/PilotAvatarTab';
import {
  ArrowLeft,
  Check,
  Gamepad2,
  Headphones,
  Monitor,
  RotateCcw,
  User,
} from 'lucide-react';

interface SettingsScreenProps {
  initialTab?: SettingsTab;
  onBack: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
  { id: 'avatar', label: 'Pilot & Suit', icon: User },
  { id: 'audio', label: 'Audio & SFX', icon: Headphones },
  { id: 'display', label: 'Display & HUD', icon: Monitor },
  { id: 'controls', label: 'Controls & Intel', icon: Gamepad2 },
];

export function SettingsScreen({ initialTab = 'avatar', onBack }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [previewingTrack, setPreviewingTrack] = useState<MusicTrackId | null>(null);
  const crtScanlines = useSettingsStore((s) => s.crtScanlines);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  useEffect(() => {
    return () => {
      music.setPreviewTrack(null);
    };
  }, []);

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

  const handleResetAllSettings = () => {
    sounds.playUiClick();
    setPreviewingTrack(null);
    music.setPreviewTrack(null);
    resetSettings();
  };

  return (
    <div className="min-h-screen w-full cyber-grid-bg text-slate-100 flex flex-col relative overflow-y-auto select-none">
      {crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Top Header */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 pt-4 sm:pt-6 pb-3 flex items-center justify-between gap-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onBack();
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/90 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Back to Hangar</span>
          </button>

          <div>
            <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest block">
              // SYSTEM CONFIGURATION //
            </span>
            <h1 className="text-lg sm:text-xl font-black italic tracking-wider text-white uppercase">
              Settings &amp; Armory
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer">
            <Check className="w-3 h-3" /> Auto-Saved
          </span>
          <button
            type="button"
            onClick={handleResetAllSettings}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
            title="Reset Audio, Display & Loadout Settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout: Left Navigation Tabs + Right Settings Panel */}
      <main className="relative z-20 flex-1 w-full max-w-6xl mx-auto px-4 py-5 flex flex-col lg:flex-row gap-5">
        <nav className="w-full lg:w-60 shrink-0 grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col gap-2">
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
                className={`flex items-center gap-2.5 px-4 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-white glow-cyan'
                    : 'bg-slate-950/75 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="flex-1 cyber-panel clip-chamfer-lg p-4 sm:p-6 border border-cyan-500/30">
          {activeTab === 'avatar' && <PilotAvatarTab />}
          {activeTab === 'audio' && (
            <AudioSettingsTab
              previewingTrack={previewingTrack}
              onToggleTrackPreview={handleToggleTrackPreview}
              onStopTrackPreview={() => setPreviewingTrack(null)}
            />
          )}
          {activeTab === 'display' && <DisplayHudTab />}
          {activeTab === 'controls' && <ControlsIntelTab />}
        </section>
      </main>
    </div>
  );
}
