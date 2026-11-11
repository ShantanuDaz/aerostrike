import type { WeaponType } from '../combat/types';
import type { Team } from '../ctf/types';

export const FAST_CHANNEL_LABEL = 'aerostrike-fast';
export const FAST_CHANNEL_ID = 10;

export const MSG_CLIENT_STATE = 0x01;
export const MSG_WORLD_BATCH = 0x02;

export const CLIENT_STATE_BYTES = 14;
export const BATCH_HEADER_BYTES = 4;
export const BATCH_ENTRY_BYTES = 14;

export const WEAPON_INDEX_TO_TYPE: readonly WeaponType[] = [
  'pistol',
  'rifle',
  'shotgun',
  'sniper',
  'rocket',
];

const WEAPON_TYPE_TO_INDEX: Record<WeaponType, number> = {
  pistol: 0,
  rifle: 1,
  shotgun: 2,
  sniper: 3,
  rocket: 4,
};

export interface QuantizedPlayerState {
  xq: number;     // int16 (x * 2 -> 0.5px precision, +/-16380px range)
  yq: number;     // int16 (y * 2)
  vxq: number;    // int16 (vx * 64)
  vyq: number;    // int16 (vy * 64)
  aimQ: number;   // int16 (normalized [-PI, PI] * 1000)
  health: number; // uint8 (bits0..6 health 0..127, bit7 invulnerable)
  flags: number;  // bit0 boosting, bit1 dead, bit2 flag, bit3 grounded, bits4..6 weapon, bit7 team
}

export interface UnpackedPlayerState {
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  health: number;
  isInvulnerable: boolean;
  isBoosting: boolean;
  isDead: boolean;
  carryingFlag: boolean;
  isGrounded: boolean;
  weaponType: WeaponType;
}

export interface DecodedClientStatePacket {
  seq: number;
  quantized: QuantizedPlayerState;
  state: UnpackedPlayerState;
}

export interface WorldBatchEntry {
  slot: number;
  seq: number;
  quantized: QuantizedPlayerState;
  state: UnpackedPlayerState;
}

export interface HostBatchSourceEntry {
  slot: number;
  seq: number;
  quantized: QuantizedPlayerState;
}

export interface DecodedWorldBatchPacket {
  tickSeq: number;
  entries: WorldBatchEntry[];
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return 0;
  return val < min ? min : val > max ? max : val;
}

export function normalizeAngleRad(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function quantizePlayerState(params: {
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  health: number;
  isInvulnerable?: boolean;
  isBoosting: boolean;
  isDead: boolean;
  carryingFlag: boolean;
  isGrounded: boolean;
  weaponType: WeaponType;
}): QuantizedPlayerState {
  const xq = Math.round(clamp(params.x, -16380, 16380) * 2);
  const yq = Math.round(clamp(params.y, -16380, 16380) * 2);
  const vxq = Math.round(clamp(params.vx, -510, 510) * 64);
  const vyq = Math.round(clamp(params.vy, -510, 510) * 64);
  const aimQ = Math.round(normalizeAngleRad(params.aimAngle) * 1000);
  const health =
    Math.round(clamp(params.health, 0, 127)) | (params.isInvulnerable ? 0x80 : 0);

  const weaponIdx = WEAPON_TYPE_TO_INDEX[params.weaponType] ?? 1;
  const flags =
    (params.isBoosting ? 1 : 0) |
    (params.isDead ? 2 : 0) |
    (params.carryingFlag ? 4 : 0) |
    (params.isGrounded ? 8 : 0) |
    ((weaponIdx & 0x07) << 4) |
    (params.team === 'red' ? 128 : 0);

  return { xq, yq, vxq, vyq, aimQ, health, flags };
}

export function unpackQuantizedPlayerState(q: QuantizedPlayerState): UnpackedPlayerState {
  const weaponIdx = (q.flags >> 4) & 0x07;
  return {
    team: (q.flags & 128) !== 0 ? 'red' : 'blue',
    x: q.xq / 2,
    y: q.yq / 2,
    vx: q.vxq / 64,
    vy: q.vyq / 64,
    aimAngle: q.aimQ / 1000,
    health: q.health & 0x7f,
    isInvulnerable: (q.health & 0x80) !== 0,
    isBoosting: (q.flags & 1) !== 0,
    isDead: (q.flags & 2) !== 0,
    carryingFlag: (q.flags & 4) !== 0,
    isGrounded: (q.flags & 8) !== 0,
    weaponType: WEAPON_INDEX_TO_TYPE[weaponIdx] ?? 'rifle',
  };
}

export function hasSignificantQuantizedDelta(
  prev: QuantizedPlayerState | null,
  next: QuantizedPlayerState,
): { dirty: boolean; discreteChanged: boolean } {
  if (!prev) {
    return { dirty: true, discreteChanged: true };
  }

  const discreteChanged =
    prev.flags !== next.flags || prev.health !== next.health;
  if (discreteChanged) {
    return { dirty: true, discreteChanged: true };
  }

  const aimDiff = Math.abs(prev.aimQ - next.aimQ);
  const wrappedAimDiff = Math.min(aimDiff, Math.abs(6283 - aimDiff));

  const moved =
    Math.abs(prev.xq - next.xq) >= 2 || // >= 1.0 px
    Math.abs(prev.yq - next.yq) >= 2 ||
    Math.abs(prev.vxq - next.vxq) >= 4 ||
    Math.abs(prev.vyq - next.vyq) >= 4 ||
    wrappedAimDiff >= 15; // ~0.85 deg

  return { dirty: moved, discreteChanged: false };
}

export function isNewerSeq8(incoming: number, last: number): boolean {
  const diff = (incoming - last + 256) & 0xff;
  return diff > 0 && diff < 128;
}

export function isNewerSeq16(incoming: number, last: number): boolean {
  const diff = (incoming - last + 65536) & 0xffff;
  return diff > 0 && diff < 32768;
}

export function encodeClientState(seq: number, q: QuantizedPlayerState): ArrayBuffer {
  const buf = new ArrayBuffer(CLIENT_STATE_BYTES);
  const view = new DataView(buf);
  view.setUint8(0, MSG_CLIENT_STATE);
  view.setUint8(1, seq & 0xff);
  view.setInt16(2, q.xq, true);
  view.setInt16(4, q.yq, true);
  view.setInt16(6, q.vxq, true);
  view.setInt16(8, q.vyq, true);
  view.setInt16(10, q.aimQ, true);
  view.setUint8(12, q.health & 0xff);
  view.setUint8(13, q.flags & 0xff);
  return buf;
}

export function decodeClientState(buf: ArrayBuffer): DecodedClientStatePacket | null {
  if (buf.byteLength < CLIENT_STATE_BYTES) return null;
  const view = new DataView(buf);
  if (view.getUint8(0) !== MSG_CLIENT_STATE) return null;

  const seq = view.getUint8(1);
  const quantized: QuantizedPlayerState = {
    xq: view.getInt16(2, true),
    yq: view.getInt16(4, true),
    vxq: view.getInt16(6, true),
    vyq: view.getInt16(8, true),
    aimQ: view.getInt16(10, true),
    health: view.getUint8(12),
    flags: view.getUint8(13),
  };

  return {
    seq,
    quantized,
    state: unpackQuantizedPlayerState(quantized),
  };
}

export function encodeWorldBatch(
  tickSeq: number,
  entries: readonly HostBatchSourceEntry[],
): ArrayBuffer {
  const count = Math.min(entries.length, 255);
  const buf = new ArrayBuffer(BATCH_HEADER_BYTES + count * BATCH_ENTRY_BYTES);
  const view = new DataView(buf);

  view.setUint8(0, MSG_WORLD_BATCH);
  view.setUint16(1, tickSeq & 0xffff, true);
  view.setUint8(3, count);

  let offset = BATCH_HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    const item = entries[i];
    const q = item.quantized;
    view.setUint8(offset, item.slot & 0xff);
    view.setUint8(offset + 1, item.seq & 0xff);
    view.setInt16(offset + 2, q.xq, true);
    view.setInt16(offset + 4, q.yq, true);
    view.setInt16(offset + 6, q.vxq, true);
    view.setInt16(offset + 8, q.vyq, true);
    view.setInt16(offset + 10, q.aimQ, true);
    view.setUint8(offset + 12, q.health & 0xff);
    view.setUint8(offset + 13, q.flags & 0xff);
    offset += BATCH_ENTRY_BYTES;
  }

  return buf;
}

export function decodeWorldBatch(buf: ArrayBuffer): DecodedWorldBatchPacket | null {
  if (buf.byteLength < BATCH_HEADER_BYTES) return null;
  const view = new DataView(buf);
  if (view.getUint8(0) !== MSG_WORLD_BATCH) return null;

  const tickSeq = view.getUint16(1, true);
  const count = view.getUint8(3);
  if (buf.byteLength < BATCH_HEADER_BYTES + count * BATCH_ENTRY_BYTES) {
    return null;
  }

  const entries: WorldBatchEntry[] = new Array(count);
  let offset = BATCH_HEADER_BYTES;

  for (let i = 0; i < count; i++) {
    const slot = view.getUint8(offset);
    const seq = view.getUint8(offset + 1);
    const quantized: QuantizedPlayerState = {
      xq: view.getInt16(offset + 2, true),
      yq: view.getInt16(offset + 4, true),
      vxq: view.getInt16(offset + 6, true),
      vyq: view.getInt16(offset + 8, true),
      aimQ: view.getInt16(offset + 10, true),
      health: view.getUint8(offset + 12),
      flags: view.getUint8(offset + 13),
    };
    entries[i] = {
      slot,
      seq,
      quantized,
      state: unpackQuantizedPlayerState(quantized),
    };
    offset += BATCH_ENTRY_BYTES;
  }

  return { tickSeq, entries };
}
