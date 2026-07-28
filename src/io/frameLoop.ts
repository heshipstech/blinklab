export function startFrameLoop(onFrame: (nowMs: number) => void): void {
  function tick(nowMs: number): void {
    onFrame(nowMs);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
