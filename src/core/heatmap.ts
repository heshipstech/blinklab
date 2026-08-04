import type { ScreenPoint } from "./calibrationProfile";

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

// Bins one screen fraction point into its cell. Exactly 1.0 is still
// the screen's far edge and lands in the last cell, anything outside
// the unit square is off screen and accumulates nowhere.
export function accumulate(grid: HeatmapGrid, point: ScreenPoint): HeatmapGrid {
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
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
