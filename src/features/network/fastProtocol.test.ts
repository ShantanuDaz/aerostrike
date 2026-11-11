import { describe, expect, it } from 'vitest';
import {
  BATCH_ENTRY_BYTES,
  BATCH_HEADER_BYTES,
  CLIENT_STATE_BYTES,
  decodeClientState,
  decodeWorldBatch,
  encodeClientState,
  encodeWorldBatch,
  hasSignificantQuantizedDelta,
  isNewerSeq8,
  isNewerSeq16,
  MSG_CLIENT_STATE,
  MSG_WORLD_BATCH,
  normalizeAngleRad,
  quantizePlayerState,
  unpackQuantizedPlayerState,
  WEAPON_INDEX_TO_TYPE,
} from './fastProtocol';

describe('fastProtocol binary codec and quantization', () => {
  it('normalizes angles onto [-PI, PI] and sanitizes non-finite numbers', () => {
    expect(normalizeAngleRad(Math.PI * 3)).toBeCloseTo(Math.PI, 4);
    expect(normalizeAngleRad(-Math.PI * 3)).toBeCloseTo(-Math.PI, 4);
    expect(normalizeAngleRad(Math.PI * 2 + 0.5)).toBeCloseTo(0.5, 4);
    expect(normalizeAngleRad(Number.NaN)).toBe(0);
    expect(normalizeAngleRad(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('quantizes and unpacks all player fields, bitflags, and all weapon types accurately', () => {
    for (const weaponType of WEAPON_INDEX_TO_TYPE) {
      const q = quantizePlayerState({
        team: 'red',
        x: 1234.5,
        y: 678.0,
        vx: -4.25,
        vy: 6.5,
        aimAngle: -1.75,
        health: 92,
        isInvulnerable: true,
        isBoosting: true,
        isDead: false,
        carryingFlag: true,
        isGrounded: false,
        weaponType,
      });

      const unpacked = unpackQuantizedPlayerState(q);
      expect(unpacked.team).toBe('red');
      expect(unpacked.x).toBe(1234.5);
      expect(unpacked.y).toBe(678);
      expect(unpacked.vx).toBeCloseTo(-4.25, 2);
      expect(unpacked.vy).toBeCloseTo(6.5, 2);
      expect(unpacked.aimAngle).toBeCloseTo(-1.75, 2);
      expect(unpacked.health).toBe(92);
      expect(unpacked.isInvulnerable).toBe(true);
      expect(unpacked.isBoosting).toBe(true);
      expect(unpacked.isDead).toBe(false);
      expect(unpacked.carryingFlag).toBe(true);
      expect(unpacked.isGrounded).toBe(false);
      expect(unpacked.weaponType).toBe(weaponType);
    }
  });

  it('clamps out-of-range coordinates, velocity, health, and NaN values safely', () => {
    const q = quantizePlayerState({
      team: 'blue',
      x: 999999,
      y: -999999,
      vx: Number.NaN,
      vy: 1200,
      aimAngle: Number.POSITIVE_INFINITY,
      health: 250,
      isInvulnerable: false,
      isBoosting: false,
      isDead: true,
      carryingFlag: false,
      isGrounded: true,
      weaponType: 'pistol',
    });

    const unpacked = unpackQuantizedPlayerState(q);
    expect(unpacked.x).toBe(16380);
    expect(unpacked.y).toBe(-16380);
    expect(unpacked.vx).toBe(0);
    expect(unpacked.vy).toBe(510);
    expect(unpacked.aimAngle).toBe(0);
    expect(unpacked.health).toBe(127);
    expect(unpacked.isInvulnerable).toBe(false);
    expect(unpacked.isDead).toBe(true);
    expect(unpacked.isGrounded).toBe(true);
  });

  it('detects significant quantized deltas and ignores sub-threshold jitter', () => {
    const base = quantizePlayerState({
      team: 'blue',
      x: 500,
      y: 300,
      vx: 0,
      vy: 0,
      aimAngle: Math.PI - 0.005,
      health: 100,
      isBoosting: false,
      isDead: false,
      carryingFlag: false,
      isGrounded: true,
      weaponType: 'rifle',
    });

    expect(hasSignificantQuantizedDelta(null, base)).toEqual({
      dirty: true,
      discreteChanged: true,
    });

    // Sub-threshold move (0.5 px) and aim crossing +PI / -PI seam without real rotation
    const jitter = quantizePlayerState({
      team: 'blue',
      x: 500.5,
      y: 300,
      vx: 0,
      vy: 0,
      aimAngle: -Math.PI + 0.004,
      health: 100,
      isBoosting: false,
      isDead: false,
      carryingFlag: false,
      isGrounded: true,
      weaponType: 'rifle',
    });
    expect(hasSignificantQuantizedDelta(base, jitter)).toEqual({
      dirty: false,
      discreteChanged: false,
    });

    // Position delta >= 1.0 px triggers dirty without discreteChanged
    const moved = { ...base, xq: base.xq + 2 };
    expect(hasSignificantQuantizedDelta(base, moved)).toEqual({
      dirty: true,
      discreteChanged: false,
    });

    // Bitflag or health change triggers discreteChanged
    const healed = { ...base, health: base.health - 10 };
    expect(hasSignificantQuantizedDelta(base, healed)).toEqual({
      dirty: true,
      discreteChanged: true,
    });
  });

  it('validates 8-bit and 16-bit sequence numbers across wraparound boundaries', () => {
    expect(isNewerSeq8(10, 9)).toBe(true);
    expect(isNewerSeq8(9, 9)).toBe(false);
    expect(isNewerSeq8(2, 254)).toBe(true); // wrapped around 255 -> 0 -> 2
    expect(isNewerSeq8(254, 2)).toBe(false); // stale old packet

    expect(isNewerSeq16(100, 99)).toBe(true);
    expect(isNewerSeq16(100, 100)).toBe(false);
    expect(isNewerSeq16(3, 65534)).toBe(true); // wrapped around 65535
    expect(isNewerSeq16(65534, 3)).toBe(false);
  });

  it('round-trips encodeClientState/decodeClientState and rejects malformed packets', () => {
    const q = quantizePlayerState({
      team: 'blue',
      x: 320.5,
      y: 840,
      vx: 2.5,
      vy: -3.25,
      aimAngle: 0.75,
      health: 64,
      isInvulnerable: true,
      isBoosting: true,
      isDead: false,
      carryingFlag: false,
      isGrounded: false,
      weaponType: 'sniper',
    });

    const buf = encodeClientState(251, q);
    expect(buf.byteLength).toBe(CLIENT_STATE_BYTES);

    const decoded = decodeClientState(buf);
    expect(decoded).not.toBeNull();
    expect(decoded!.seq).toBe(251);
    expect(decoded!.quantized).toEqual(q);
    expect(decoded!.state.weaponType).toBe('sniper');
    expect(decoded!.state.isInvulnerable).toBe(true);

    // Truncated buffer or wrong message opcode -> null
    expect(decodeClientState(buf.slice(0, CLIENT_STATE_BYTES - 1))).toBeNull();
    const badOpcode = new Uint8Array(buf.slice(0));
    badOpcode[0] = MSG_WORLD_BATCH;
    expect(decodeClientState(badOpcode.buffer)).toBeNull();
  });

  it('round-trips encodeWorldBatch/decodeWorldBatch across multiple player slots', () => {
    const q0 = quantizePlayerState({
      team: 'blue',
      x: 200,
      y: 900,
      vx: 1.5,
      vy: 0,
      aimAngle: 0,
      health: 100,
      isBoosting: false,
      isDead: false,
      carryingFlag: true,
      isGrounded: true,
      weaponType: 'rocket',
    });
    const q1 = quantizePlayerState({
      team: 'red',
      x: 1800,
      y: 450,
      vx: -2.0,
      vy: 4.5,
      aimAngle: -2.2,
      health: 45,
      isInvulnerable: false,
      isBoosting: true,
      isDead: false,
      carryingFlag: false,
      isGrounded: false,
      weaponType: 'shotgun',
    });

    const buf = encodeWorldBatch(40123, [
      { slot: 0, seq: 14, quantized: q0 },
      { slot: 3, seq: 255, quantized: q1 },
    ]);
    expect(buf.byteLength).toBe(BATCH_HEADER_BYTES + 2 * BATCH_ENTRY_BYTES);

    const decoded = decodeWorldBatch(buf);
    expect(decoded).not.toBeNull();
    expect(decoded!.tickSeq).toBe(40123);
    expect(decoded!.entries).toHaveLength(2);
    expect(decoded!.entries[0].slot).toBe(0);
    expect(decoded!.entries[0].state.carryingFlag).toBe(true);
    expect(decoded!.entries[0].state.weaponType).toBe('rocket');
    expect(decoded!.entries[1].slot).toBe(3);
    expect(decoded!.entries[1].seq).toBe(255);
    expect(decoded!.entries[1].state.team).toBe('red');
    expect(decoded!.entries[1].state.weaponType).toBe('shotgun');

    // Truncated body or wrong opcode -> null
    expect(decodeWorldBatch(buf.slice(0, buf.byteLength - 4))).toBeNull();
    const badOpcode = new Uint8Array(buf.slice(0));
    badOpcode[0] = MSG_CLIENT_STATE;
    expect(decodeWorldBatch(badOpcode.buffer)).toBeNull();
  });
});
