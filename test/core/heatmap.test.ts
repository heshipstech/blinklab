import { describe, expect, it } from "vitest";

import {
  accumulate,
  emptyGrid,
  HEATMAP_COLS,
  HEATMAP_ROWS,
  normalizedCells,
} from "../../src/core/heatmap";

describe("emptyGrid", () => {
  it("has one zeroed cell per grid position", () => {
    const grid = emptyGrid();
    expect(grid.cols).toBe(HEATMAP_COLS);
    expect(grid.rows).toBe(HEATMAP_ROWS);
    expect(grid.cells.length).toBe(HEATMAP_COLS * HEATMAP_ROWS);
    expect(grid.cells.every((cell) => cell === 0)).toBe(true);
  });
});

describe("accumulate", () => {
  it("bins hand checkable points into row major cells", () => {
    // A tiny 4 by 2 grid keeps the arithmetic in your head: cell
    // index is row times cols plus col, floor of fraction times size.
    let grid = emptyGrid(4, 2);
    grid = accumulate(grid, { x: 0, y: 0 });
    grid = accumulate(grid, { x: 0.3, y: 0.4 });
    grid = accumulate(grid, { x: 0.3, y: 0.4 });
    grid = accumulate(grid, { x: 0.8, y: 0.9 });
    // (0,0) -> col 0, row 0 -> index 0. (0.3,0.4) -> col 1, row 0 ->
    // index 1, twice. (0.8,0.9) -> col 3, row 1 -> index 7.
    expect(grid.cells).toEqual([1, 2, 0, 0, 0, 0, 0, 1]);
  });

  it("runs the boundary trio at the far edge: exactly one stays inside", () => {
    let grid = emptyGrid(4, 2);
    grid = accumulate(grid, { x: 0.999, y: 0.999 });
    grid = accumulate(grid, { x: 1, y: 1 });
    grid = accumulate(grid, { x: 1.001, y: 1 });
    // The first two both land in the last cell, the third is off the
    // grid and ignored.
    expect(grid.cells[7]).toBe(2);
    expect(grid.cells.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("ignores points outside the unit square entirely", () => {
    const grid = emptyGrid(4, 2);
    const after = accumulate(accumulate(grid, { x: -0.1, y: 0.5 }), {
      x: 0.5,
      y: 1.2,
    });
    expect(after.cells.every((cell) => cell === 0)).toBe(true);
  });

  it("never mutates the input grid", () => {
    const before = emptyGrid(4, 2);
    accumulate(before, { x: 0.5, y: 0.5 });
    expect(before.cells.every((cell) => cell === 0)).toBe(true);
  });
});

describe("normalizedCells", () => {
  it("scales the hottest cell to exactly one", () => {
    let grid = emptyGrid(4, 2);
    grid = accumulate(grid, { x: 0, y: 0 });
    grid = accumulate(grid, { x: 0, y: 0 });
    grid = accumulate(grid, { x: 0, y: 0 });
    grid = accumulate(grid, { x: 0, y: 0.9 });
    const cells = normalizedCells(grid);
    expect(cells).not.toBeNull();
    expect(cells?.[0]).toBe(1);
    expect(cells?.[4]).toBeCloseTo(1 / 3, 12);
  });

  it("refuses an untouched grid with null, nothing to draw", () => {
    expect(normalizedCells(emptyGrid(4, 2))).toBeNull();
  });
});
