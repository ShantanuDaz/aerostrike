import type { Team } from '../../ctf/types';
import type { HolodeckWeaponId } from '../core/types';

export const HOLODECK_PACKET_BYTES = 16;
export const HOLODECK_FAST_CHANNEL_LABEL = 'aerostrike-fast-3d';

export interface HolodeckPacketInputBits {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  fire: boolean;
  plant: boolean;
  defuse: boolean;
  reload: boolean;
  weapon: HolodeckWeaponId;
  isAlive: boolean;
  team: Team;
}

export interface HolodeckWireState {
  seq: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  inputs: HolodeckPacketInputBits;
  health: number;
  armor: number;
}

const WEAPON_TO_INT: Record<HolodeckWeaponId, number> = {
  knife: 0,
  classic: 1,
  vandal: 2,
  operator: 3,
};

const INT_TO_WEAPON: readonly HolodeckWeaponId[] = ['knife', 'classic', 'vandal', 'operator'];

/**
 * Encodes a 3D player state into a 16-byte ArrayBuffer with zero heap garbage.
 */
export function encodeHolodeckPacket(
  state: HolodeckWireState,
  targetBuffer?: ArrayBuffer,
): ArrayBuffer {
  const buf = targetBuffer ?? new ArrayBuffer(HOLODECK_PACKET_BYTES);
  const view = new DataView(buf);

  // Bytes 0-5: Pos (X, Y, Z) quantized in [-128..+128]m with 256 steps/meter (3.9mm resolution)
  const qx = Math.max(0, Math.min(65535, Math.round((state.x + 128) * 256)));
  const qy = Math.max(0, Math.min(65535, Math.round((state.y + 128) * 256)));
  const qz = Math.max(0, Math.min(65535, Math.round((state.z + 128) * 256)));
  view.setUint16(0, qx, true);
  view.setUint16(2, qy, true);
  view.setUint16(4, qz, true);

  // Bytes 6-8: Vel (vx, vy, vz) in [-16..+16]m/s quantized to 8-bit int (-128..127)
  const qvx = Math.max(-128, Math.min(127, Math.round(state.vx * 7.5)));
  const qvy = Math.max(-128, Math.min(127, Math.round(state.vy * 7.5)));
  const qvz = Math.max(-128, Math.min(127, Math.round(state.vz * 7.5)));
  view.setInt8(6, qvx);
  view.setInt8(7, qvy);
  view.setInt8(8, qvz);

  // Bytes 9-10: Angles (yaw, pitch) mapped into uint8 (0..255)
  const tau = Math.PI * 2;
  const normYaw = ((state.yaw % tau) + tau) % tau;
  const qYaw = Math.max(0, Math.min(255, Math.round((normYaw / tau) * 255)));

  const normPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.pitch));
  const qPitch = Math.max(0, Math.min(255, Math.round(((normPitch + Math.PI / 2) / Math.PI) * 255)));
  view.setUint8(9, qYaw);
  view.setUint8(10, qPitch);

  // Bytes 11-12: Inputs (16-bit bitmask)
  let mask = 0;
  if (state.inputs.forward) mask |= 1 << 0;
  if (state.inputs.backward) mask |= 1 << 1;
  if (state.inputs.left) mask |= 1 << 2;
  if (state.inputs.right) mask |= 1 << 3;
  if (state.inputs.jump) mask |= 1 << 4;
  if (state.inputs.crouch) mask |= 1 << 5;
  if (state.inputs.sprint) mask |= 1 << 6;
  if (state.inputs.fire) mask |= 1 << 7;
  if (state.inputs.plant) mask |= 1 << 8;
  if (state.inputs.defuse) mask |= 1 << 9;
  if (state.inputs.reload) mask |= 1 << 10;
  const weaponInt = WEAPON_TO_INT[state.inputs.weapon] ?? 2;
  mask |= (weaponInt & 0x03) << 11;
  if (state.inputs.isAlive) mask |= 1 << 13;
  if (state.inputs.team === 'red') mask |= 1 << 14;
  view.setUint16(11, mask, true);

  // Byte 13: Packet sequence number (0..255)
  view.setUint8(13, state.seq & 0xff);

  // Byte 14: Health (0..100)
  view.setUint8(14, Math.max(0, Math.min(100, Math.round(state.health))));

  // Byte 15: Armor (0..50)
  view.setUint8(15, Math.max(0, Math.min(50, Math.round(state.armor))));

  return buf;
}

/**
 * Decodes a 16-byte ArrayBuffer into a HolodeckWireState.
 */
export function decodeHolodeckPacket(buffer: ArrayBuffer): HolodeckWireState {
  const view = new DataView(buffer);

  const x = view.getUint16(0, true) / 256 - 128;
  const y = view.getUint16(2, true) / 256 - 128;
  const z = view.getUint16(4, true) / 256 - 128;

  const vx = view.getInt8(6) / 7.5;
  const vy = view.getInt8(7) / 7.5;
  const vz = view.getInt8(8) / 7.5;

  const tau = Math.PI * 2;
  const yaw = (view.getUint8(9) / 255) * tau;
  const pitch = (view.getUint8(10) / 255) * Math.PI - Math.PI / 2;

  const mask = view.getUint16(11, true);
  const weaponInt = (mask >> 11) & 0x03;

  const inputs: HolodeckPacketInputBits = {
    forward: (mask & (1 << 0)) !== 0,
    backward: (mask & (1 << 1)) !== 0,
    left: (mask & (1 << 2)) !== 0,
    right: (mask & (1 << 3)) !== 0,
    jump: (mask & (1 << 4)) !== 0,
    crouch: (mask & (1 << 5)) !== 0,
    sprint: (mask & (1 << 6)) !== 0,
    fire: (mask & (1 << 7)) !== 0,
    plant: (mask & (1 << 8)) !== 0,
    defuse: (mask & (1 << 9)) !== 0,
    reload: (mask & (1 << 10)) !== 0,
    weapon: INT_TO_WEAPON[weaponInt] ?? 'vandal',
    isAlive: (mask & (1 << 13)) !== 0,
    team: (mask & (1 << 14)) !== 0 ? 'red' : 'blue',
  };

  const seq = view.getUint8(13);
  const health = view.getUint8(14);
  const armor = view.getUint8(15);

  return { seq, x, y, z, vx, vy, vz, yaw, pitch, inputs, health, armor };
}
