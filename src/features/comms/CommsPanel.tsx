import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { sounds } from '../audio/soundEngine';
import { networkManager } from '../network/peerRoom';
import { useNetworkStore } from '../network/networkStore';
import { useAvatarStore } from '../avatar/avatarStore';
import { useChatStore } from './chatStore';
import { useVoiceStore } from './voiceStore';
import { voiceManager } from './voiceManager';
import { MAX_CHAT_TEXT_LENGTH, QUICK_EMOJIS, type ChatKind } from './types';

function sendCommsMessage(kind: ChatKind, rawText: string) {
  const sent = networkManager.broadcastChat(kind, rawText);
  if (sent) {
    sounds.playUiClick();
  }
}

interface VoiceMicButtonProps {
  compact?: boolean;
  showLabelOnDesktop?: boolean;
}

export function VoiceMicButton({
  compact = false,
  showLabelOnDesktop = true,
}: VoiceMicButtonProps) {
  const micEnabled = useVoiceStore((s) => s.micEnabled);
  const micPermission = useVoiceStore((s) => s.micPermission);
  const isLocalSpeaking = useVoiceStore((s) => s.isLocalSpeaking);
  const remoteSpeakingByPlayerId = useVoiceStore((s) => s.remoteSpeakingByPlayerId);

  const remoteSpeakingCount = Object.values(remoteSpeakingByPlayerId).filter(Boolean).length;
  const isRequesting = micPermission === 'requesting';

  return (
    <button
      type="button"
      data-no-joystick="true"
      disabled={isRequesting}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={() => {
        sounds.playUiClick();
        void voiceManager.unlockRemoteAudio();
        void voiceManager.toggleMic();
      }}
      className={`${
        compact ? 'min-w-[36px] min-h-[36px] px-2 sm:px-2.5' : 'p-1.5 sm:px-3 sm:py-2'
      } relative bg-slate-950/85 hover:bg-slate-900 border transition cursor-pointer clip-chamfer flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider shrink-0 ${
        micEnabled
          ? isLocalSpeaking
            ? 'border-emerald-300 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
            : 'border-emerald-400/70 bg-emerald-950/50 text-emerald-300'
          : isRequesting
            ? 'border-amber-400/70 text-amber-300 animate-pulse'
            : 'border-slate-700/80 hover:border-cyan-400/50 text-slate-300 hover:text-white'
      }`}
      title={
        micEnabled
          ? 'Mute / Turn Off Voice Mic'
          : 'Enable Voice Mic & Talk to Squad'
      }
      aria-label={micEnabled ? 'Turn Off Voice Mic' : 'Enable Voice Mic'}
    >
      {micEnabled ? (
        <Mic className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLocalSpeaking ? 'animate-pulse text-emerald-300' : 'text-emerald-400'}`} />
      ) : (
        <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
      )}
      {showLabelOnDesktop && (
        <span className="hidden md:inline">
          {isRequesting ? 'Mic...' : micEnabled ? (isLocalSpeaking ? 'Live' : 'Mic On') : 'Voice'}
        </span>
      )}
      {remoteSpeakingCount > 0 && (
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 animate-ping"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function VoiceStatusToast() {
  const micError = useVoiceStore((s) => s.micError);
  const autoplayBlocked = useVoiceStore((s) => s.autoplayBlocked);
  const setMicPermission = useVoiceStore((s) => s.setMicPermission);

  if (!micError && !autoplayBlocked) return null;

  return (
    <div
      data-no-joystick="true"
      onTouchStart={(e) => e.stopPropagation()}
      className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-2.5 py-1 bg-slate-950/90 border border-amber-400/60 text-amber-200 text-[10px] font-mono clip-chamfer shadow-lg"
    >
      {autoplayBlocked && (
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            void voiceManager.unlockRemoteAudio();
          }}
          className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-bold uppercase clip-chamfer cursor-pointer"
        >
          <Volume2 className="w-3 h-3" />
          <span>Tap to Hear Squad Voice</span>
        </button>
      )}
      {micError && (
        <div className="flex items-center gap-1.5">
          <span>{micError}</span>
          <button
            type="button"
            onClick={() => setMicPermission('idle', null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss voice warning"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveSpeakersStrip() {
  const roster = useNetworkStore((s) => s.roster);
  const localPlayerId = useAvatarStore((s) => s.playerId);
  const localCallsign = useAvatarStore((s) => s.avatar.callsign);
  const micEnabled = useVoiceStore((s) => s.micEnabled);
  const isLocalSpeaking = useVoiceStore((s) => s.isLocalSpeaking);
  const remoteMicByPlayerId = useVoiceStore((s) => s.remoteMicByPlayerId);
  const remoteSpeakingByPlayerId = useVoiceStore((s) => s.remoteSpeakingByPlayerId);
  const mutedPlayerIds = useVoiceStore((s) => s.mutedPlayerIds);

  const activeSpeakers: {
    id: string;
    callsign: string;
    speaking: boolean;
    isLocal: boolean;
    muted: boolean;
  }[] = [];

  if (micEnabled) {
    activeSpeakers.push({
      id: localPlayerId,
      callsign: localCallsign,
      speaking: isLocalSpeaking,
      isLocal: true,
      muted: false,
    });
  }

  for (const member of Object.values(roster)) {
    if (!member.isOnline || member.playerId === localPlayerId) continue;
    const hasMic =
      Boolean(remoteMicByPlayerId[member.playerId]) ||
      Boolean(remoteSpeakingByPlayerId[member.playerId]);
    if (!hasMic) continue;
    activeSpeakers.push({
      id: member.playerId,
      callsign: member.callsign,
      speaking: Boolean(remoteSpeakingByPlayerId[member.playerId]),
      isLocal: false,
      muted: Boolean(mutedPlayerIds[member.playerId]),
    });
  }

  if (activeSpeakers.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {activeSpeakers.map((sp) => (
        <button
          key={sp.id}
          type="button"
          disabled={sp.isLocal}
          onClick={() => {
            if (sp.isLocal) return;
            useVoiceStore.getState().toggleMuteRemotePlayer(sp.id);
            voiceManager.refreshRemoteAudioVolumes();
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold clip-chamfer border transition ${
            sp.muted
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 cursor-pointer'
              : sp.speaking
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900/80 border-slate-700 text-slate-300'
          } ${sp.isLocal ? 'cursor-default' : 'cursor-pointer hover:border-cyan-400/60'}`}
          title={
            sp.isLocal
              ? 'Your mic is active'
              : sp.muted
                ? `Unmute ${sp.callsign}`
                : `Mute ${sp.callsign}`
          }
        >
          {sp.muted ? (
            <VolumeX className="w-2.5 h-2.5 text-rose-400" />
          ) : (
            <Mic className={`w-2.5 h-2.5 ${sp.speaking ? 'text-emerald-300 animate-pulse' : 'text-emerald-400/80'}`} />
          )}
          <span className="max-w-[74px] truncate">
            {sp.isLocal ? 'You' : sp.callsign}
          </span>
        </button>
      ))}
    </div>
  );
}

export function WarRoomCommsPanel() {
  const messages = useChatStore((s) => s.messages);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [expanded, messages.length]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendCommsMessage('text', draft);
    setDraft('');
  };

  const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <div className="w-full max-w-md pointer-events-auto flex flex-col gap-1">
      <VoiceStatusToast />

      <div className="cyber-panel clip-chamfer border border-cyan-500/35 bg-slate-950/85 backdrop-blur-md shadow-xl overflow-hidden">
        {/* Top Comms Bar: Toggle + Always-Available Quick Emojis */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1.5 bg-slate-950/90 border-b border-slate-800/70">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              setExpanded((v) => !v);
            }}
            className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-wider text-cyan-300 hover:text-white cursor-pointer shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Comms</span>
            {messages.length > 0 && (
              <span className="px-1 py-px bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[9px]">
                {messages.length}
              </span>
            )}
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {/* Always-available Quick-Send Emojis */}
          <div className="flex items-center gap-1">
            {QUICK_EMOJIS.map((item) => (
              <button
                key={item.emoji}
                type="button"
                onClick={() => sendCommsMessage('emoji', item.emoji)}
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xs bg-slate-900/90 hover:bg-cyan-500/20 border border-slate-800 hover:border-cyan-400/60 text-xs sm:text-sm transition active:scale-90 cursor-pointer"
                title={`Quick send ${item.label} (${item.emoji})`}
                aria-label={`Send ${item.label}`}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Active Voice Speakers (visible whenever anyone has mic on) */}
        <div className="px-2 pt-1 empty:hidden">
          <ActiveSpeakersStrip />
        </div>

        {/* Collapsed Latest Message Preview */}
        {!expanded && latestMsg && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full px-2.5 py-1 text-left flex items-center gap-1.5 text-[10px] sm:text-xs font-mono hover:bg-slate-900/60 transition cursor-pointer truncate"
          >
            <span
              className={`font-black shrink-0 ${
                latestMsg.senderTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'
              }`}
            >
              {latestMsg.senderCallsign}:
            </span>
            <span className="text-slate-200 truncate">{latestMsg.text}</span>
          </button>
        )}

        {/* Expanded Chat History + Text Input */}
        {expanded && (
          <div className="flex flex-col">
            <div
              ref={scrollRef}
              className="max-h-32 sm:max-h-40 overflow-y-auto cyber-scroll px-2.5 py-1.5 flex flex-col gap-1 text-[11px] font-mono"
            >
              {messages.length === 0 ? (
                <div className="text-[10px] text-slate-500 italic py-2 text-center">
                  Squad comms ready. Send a message, tap an emoji, or enable Voice!
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="leading-snug break-words">
                    <span
                      className={`font-black mr-1.5 ${
                        m.senderTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'
                      }`}
                    >
                      {m.senderCallsign}:
                    </span>
                    <span className={m.kind === 'emoji' ? 'text-base align-middle' : 'text-slate-100'}>
                      {m.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-1.5 p-1.5 border-t border-slate-800/80 bg-slate-950/80"
            >
              <input
                type="text"
                value={draft}
                maxLength={MAX_CHAT_TEXT_LENGTH}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message squad..."
                className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-900 border border-slate-700 focus:border-cyan-400 outline-none text-xs font-mono text-white placeholder:text-slate-500 clip-chamfer"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/35 disabled:opacity-40 border border-cyan-400/60 text-cyan-200 clip-chamfer transition cursor-pointer flex items-center gap-1 text-[10px] font-mono font-black uppercase"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

interface HudCommsOverlayProps {
  isTouchHUD: boolean;
}

export function HudCommsOverlay({ isTouchHUD }: HudCommsOverlayProps) {
  const messages = useChatStore((s) => s.messages);
  const isHudChatOpen = useChatStore((s) => s.isHudChatOpen);
  const setHudChatOpen = useChatStore((s) => s.setHudChatOpen);
  const setInputFocused = useChatStore((s) => s.setInputFocused);
  const unreadCount = useChatStore((s) => s.unreadCount);

  const [draft, setDraft] = useState('');
  const [recentVisibleIds, setRecentVisibleIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSeenMsgIdRef = useRef<string | null>(null);

  // Track newly arrived messages for 5.5s transient toast display when chat drawer is closed
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.id === lastSeenMsgIdRef.current) return;
    lastSeenMsgIdRef.current = latest.id;

    const addTimer = window.setTimeout(() => {
      setRecentVisibleIds((prev) =>
        prev.includes(latest.id) ? prev : [...prev.slice(-2), latest.id],
      );
    }, 0);
    const removeTimer = window.setTimeout(() => {
      setRecentVisibleIds((prev) => prev.filter((id) => id !== latest.id));
    }, 5500);

    return () => {
      window.clearTimeout(addTimer);
      window.clearTimeout(removeTimer);
    };
  }, [messages]);

  useEffect(() => {
    if (isHudChatOpen) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      const focusTimer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(focusTimer);
    }
  }, [isHudChatOpen, messages.length]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim()) {
      sendCommsMessage('text', draft);
      setDraft('');
    } else {
      setHudChatOpen(false);
    }
  };

  const recentMessages = messages.filter((m) => recentVisibleIds.includes(m.id)).slice(-3);

  return (
    <div
      data-no-joystick="true"
      onTouchStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={
        isTouchHUD
          ? { marginBottom: 'env(safe-area-inset-bottom, 0px)' }
          : {
              marginLeft: 'env(safe-area-inset-left, 0px)',
              marginBottom: 'env(safe-area-inset-bottom, 0px)',
            }
      }
      className={
        isTouchHUD
          ? 'fixed bottom-[124px] min-[540px]:bottom-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none max-w-[90vw]'
          : 'fixed bottom-3 left-3 z-30 flex flex-col items-start gap-1.5 pointer-events-none w-[290px] sm:w-[320px]'
      }
    >
      <VoiceStatusToast />

      {/* Active Speakers Strip */}
      <div className="pointer-events-auto empty:hidden">
        <ActiveSpeakersStrip />
      </div>

      {/* Transient Incoming Chat Toasts (when closed) */}
      {!isHudChatOpen && recentMessages.length > 0 && (
        <div className="flex flex-col gap-1 w-full pointer-events-none">
          {recentMessages.map((m) => (
            <div
              key={m.id}
              className="px-2 py-0.5 bg-slate-950/80 border-l-2 border-cyan-400/70 text-[10px] sm:text-[11px] font-mono clip-chamfer backdrop-blur-xs shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-150 truncate"
            >
              <span
                className={`font-black mr-1.5 ${
                  m.senderTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'
                }`}
              >
                {m.senderCallsign}:
              </span>
              <span className={m.kind === 'emoji' ? 'text-sm align-middle' : 'text-slate-100'}>
                {m.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Chat Drawer */}
      {isHudChatOpen && (
        <div className="pointer-events-auto w-full min-w-[260px] cyber-panel clip-chamfer border border-cyan-500/50 bg-slate-950/92 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-2.5 py-1 bg-slate-950 border-b border-slate-800">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-cyan-400" />
              <span>Squad Comms</span>
            </span>
            <button
              type="button"
              onClick={() => setHudChatOpen(false)}
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Close chat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="max-h-32 overflow-y-auto cyber-scroll px-2.5 py-1.5 flex flex-col gap-1 text-[10px] sm:text-[11px] font-mono"
          >
            {messages.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic py-1.5 text-center">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="leading-snug break-words">
                  <span
                    className={`font-black mr-1.5 ${
                      m.senderTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'
                    }`}
                  >
                    {m.senderCallsign}:
                  </span>
                  <span className={m.kind === 'emoji' ? 'text-sm align-middle' : 'text-slate-100'}>
                    {m.text}
                  </span>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-1 p-1.5 border-t border-slate-800 bg-slate-950/90"
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={MAX_CHAT_TEXT_LENGTH}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setHudChatOpen(false);
                }
              }}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isTouchHUD ? 'Type message...' : 'Type message... [Enter]'}
              className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 focus:border-cyan-400 outline-none text-[11px] font-mono text-white placeholder:text-slate-500 clip-chamfer"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-200 clip-chamfer cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Always-Available Quick-Send Emoji Bar + Chat Toggle Pill */}
      <div
        className={`pointer-events-auto flex items-center gap-0.5 sm:gap-1 ${
          isTouchHUD ? 'px-1 py-0.5' : 'px-1.5 py-1'
        } bg-slate-950/85 border border-cyan-500/35 clip-chamfer backdrop-blur-md shadow-xl`}
      >
        <button
          type="button"
          onClick={() => {
            sounds.playUiClick();
            setHudChatOpen(!isHudChatOpen);
          }}
          className={`relative px-2 py-1 flex items-center gap-1 text-[9px] font-mono font-black uppercase clip-chamfer border transition cursor-pointer ${
            isHudChatOpen
              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
              : 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-400/50 text-slate-300 hover:text-white'
          }`}
          title="Toggle Squad Text Chat [Enter / T]"
          aria-label="Toggle Squad Text Chat"
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          {!isTouchHUD && <span className="hidden sm:inline">Chat</span>}
          {unreadCount > 0 && !isHudChatOpen && (
            <span className="px-1 bg-cyan-400 text-slate-950 font-black text-[8px] rounded-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="w-px h-4 bg-slate-800" />

        {QUICK_EMOJIS.map((item) => (
          <button
            key={item.emoji}
            type="button"
            onClick={() => sendCommsMessage('emoji', item.emoji)}
            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xs bg-slate-900/75 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-400/60 text-xs sm:text-sm transition active:scale-90 cursor-pointer"
            title={`Quick send ${item.label} (${item.emoji})`}
            aria-label={`Send ${item.label}`}
          >
            {item.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
