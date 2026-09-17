import { pointWithinWindow, type ScreenPoint } from "./calibrationProfile";

// The accumulation grid behind the gaze heatmap: the screen divided
// into cells, each counting how many frames the calibrated gaze
// point spent inside it. Dwell, binned. The grid is DELIBERATELY
// coarse: amendment 2 set the calibration target at quadrant level
// reliability, and a fine grid would draw precision the profile
// does not have. A blob spread over neighbouring cells is honest.
export const HEATMAP_COLS = 16;
export const HEATMAP_ROWS = 9;

export type HeatmapGrid = {
  cols: number;
  rows: number;
  // Row major: index = row * cols + col.
  cells: readonly number[];
};

export function emptyGrid(
  cols: number = HEATMAP_COLS,
  rows: number = HEATMAP_ROWS,
): HeatmapGrid {
  return { cols, rows, cells: Array<number>(cols * rows).fill(0) };
}

// Bins one window fraction point into its cell. Exactly 1.0 is still
// the window's far edge and lands in the last cell; anything outside
// the window accumulates nowhere. The boundary is pointWithinWindow,
// the ONE on-window rule (roadmap 14.9b) — this inline check used to
// be the second of two definitions, and the audit caught the export
// column disagreeing with it.
export function accumulate(grid: HeatmapGrid, point: ScreenPoint): HeatmapGrid {
  if (!pointWithinWindow(point)) {
    return grid;
  }
  const col = Math.min(grid.cols - 1, Math.floor(point.x * grid.cols));
  const row = Math.min(grid.rows - 1, Math.floor(point.y * grid.rows));
  const index = row * grid.cols + col;
  const cells = [...grid.cells];
  cells[index] = (cells[index] ?? 0) + 1;
  return { ...grid, cells };
}

// Scales the grid for display: the hottest cell becomes exactly one,
// the rest keep their proportion. An untouched grid has no hottest
// cell and nothing to draw, so it is refused as null, not drawn as
// a uniform glow.
export function normalizedCells(grid: HeatmapGrid): number[] | null {
  let max = 0;
  for (const cell of grid.cells) {
    max = Math.max(max, cell);
  }
  if (max <= 0) {
    return null;
  }
  return grid.cells.map((cell) => cell / max);
}
