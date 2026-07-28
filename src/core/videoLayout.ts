export type DisplaySize = {
  width: number;
  height: number;
};

export function displaySize(
  streamWidthPx: number,
  streamHeightPx: number,
  targetWidthPx: number,
): DisplaySize | null {
  if (streamWidthPx <= 0 || streamHeightPx <= 0 || targetWidthPx <= 0) {
    return null;
  }
  return {
    width: targetWidthPx,
    height: Math.round((streamHeightPx / streamWidthPx) * targetWidthPx),
  };
}
