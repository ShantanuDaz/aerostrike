export function formatMatchClock(sec: number): string {
  const safe = Math.max(0, Math.ceil(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
