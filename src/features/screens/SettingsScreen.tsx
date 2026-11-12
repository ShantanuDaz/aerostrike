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
  { id: 'controls', label: 'Controls', icon: Gamepad2 },
  { id: 'display', label: 'Display & HUD', icon: Monitor },
  { id: 'audio', label: 'Audio & SFX', icon: Headphones },
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
    <div className="h-[100dvh] w-full safe-insets cyber-grid-bg text-slate-100 flex flex-col relative overflow-hidden select-none">
      {crtScanlines && (
        <div className="fixed inset-0 scanline-overlay z-10 pointer-events-none" />
      )}

      {/* Top Header */}
      <header className="relative z-20 shrink-0 w-full max-w-6xl mx-auto px-2.5 sm:px-4 py-1.5 sm:tall:pt-4 sm:tall:pb-2.5 flex items-center justify-between gap-2 border-b border-cyan-500/20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              onBack();
            }}
            className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-950/90 hover:bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">Back to Hangar</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="min-w-0">
            <span className="hidden sm:tall:block text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest truncate">
              // SYSTEM CONFIGURATION //
            </span>
            <h1 className="text-sm sm:text-lg font-black italic tracking-wider text-white uppercase truncate">
              Settings &amp; Armory
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider clip-chamfer">
            <Check className="w-3 h-3" /> Auto-Saved
          </span>
          <button
            type="button"
            onClick={handleResetAllSettings}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-950/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer transition cursor-pointer"
            title="Reset Audio, Display, Controls & Loadout Settings"
            aria-label="Reset Defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout: Compact Top Tabs on Mobile/Landscape, Sidebar on XL + Split-Pane Panel */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-6xl mx-auto px-2 sm:px-4 py-1.5 sm:tall:py-3.5 flex flex-col xl:flex-row gap-2 sm:gap-4 overflow-hidden">
        <nav className="shrink-0 w-full xl:w-52 grid grid-cols-4 xl:flex xl:flex-col gap-1 sm:gap-2">
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
                className={`flex items-center justify-center xl:justify-start gap-1.5 sm:gap-2 px-1.5 sm:px-3.5 py-1.5 sm:py-2.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider clip-chamfer border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-white glow-cyan'
                    : 'bg-slate-950/75 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${active ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="flex-1 min-h-0 min-w-0 cyber-panel clip-chamfer-lg p-2 sm:p-4 border border-cyan-500/30 flex flex-col overflow-hidden">
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
