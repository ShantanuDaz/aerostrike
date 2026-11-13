import type { HolodeckWireState } from './holodeckProtocol';

export interface RemoteProxySnapshot {
  timestampMs: number;
  state: HolodeckWireState;
}

export class RemoteProxyManager {
  private snapshots: RemoteProxySnapshot[] = [];
  private renderState: HolodeckWireState | null = null;

  public pushSnapshot(state: HolodeckWireState, nowMs = performance.now()) {
    this.snapshots.push({ timestampMs: nowMs, state });
    // Keep last 15 snapshots
    if (this.snapshots.length > 15) {
      this.snapshots.shift();
    }
    if (!this.renderState) {
      this.renderState = { ...state };
    }
  }

  /**
   * Evaluates interpolated proxy state for rendering at current time minus interpolation delay (e.g. 50ms).
   */
  public getInterpolatedState(renderDelayMs = 50, nowMs = performance.now()): HolodeckWireState | null {
    if (this.snapshots.length === 0) return this.renderState;
    if (this.snapshots.length === 1) return this.snapshots[0].state;

    const targetTime = nowMs - renderDelayMs;

    // Find bounding snapshots
    let prev = this.snapshots[0];
    let next = this.snapshots[this.snapshots.length - 1];

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (
        this.snapshots[i].timestampMs <= targetTime &&
        this.snapshots[i + 1].timestampMs >= targetTime
      ) {
        prev = this.snapshots[i];
        next = this.snapshots[i + 1];
        break;
      }
    }

    const timeSpan = next.timestampMs - prev.timestampMs;
    const factor = timeSpan <= 0 ? 1 : Math.max(0, Math.min(1, (targetTime - prev.timestampMs) / timeSpan));

    // Linear interpolation of position
    const x = prev.state.x + (next.state.x - prev.state.x) * factor;
    const y = prev.state.y + (next.state.y - prev.state.y) * factor;
    const z = prev.state.z + (next.state.z - prev.state.z) * factor;

    // Shortest-path angle interpolation
    const tau = Math.PI * 2;
    let dy = (next.state.yaw - prev.state.yaw) % tau;
    if (dy > Math.PI) dy -= tau;
    if (dy < -Math.PI) dy += tau;
    const yaw = prev.state.yaw + dy * factor;

    const pitch = prev.state.pitch + (next.state.pitch - prev.state.pitch) * factor;

    return {
      ...next.state,
      x,
      y,
      z,
      yaw,
      pitch,
    };
  }
}
