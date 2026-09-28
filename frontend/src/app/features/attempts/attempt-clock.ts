// Anchor to backend UTC and advance with a monotonic clock, not the editable wall clock.
export class AttemptClock {
  private deadline = 0;
  private serverNow = 0;
  private anchor = 0;
  reset(expiresAt: string, serverNow: string, monotonicNow: number) {
    this.deadline = Date.parse(expiresAt);
    this.serverNow = Date.parse(serverNow);
    this.anchor = monotonicNow;
    return Number.isFinite(this.deadline) && Number.isFinite(this.serverNow);
  }
  remaining(monotonicNow: number) {
    return Math.max(
      0,
      Math.ceil((this.deadline - this.serverNow - Math.max(0, monotonicNow - this.anchor)) / 1000),
    );
  }
}
export function timerLabel(seconds: number) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export function timerWarning(seconds: number) {
  return seconds <= 60 ? 'urgent' : seconds <= 300 ? 'warning' : 'normal';
}
