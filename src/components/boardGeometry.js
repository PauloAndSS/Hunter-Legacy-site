export const CELL = 100,
  COLS = 12,
  ROWS = 8,
  WIDTH = COLS * CELL,
  HEIGHT = ROWS * CELL,
  UNIT = 1.5;
export function boardSize(state) {
  const limit = (v, fallback) => (Number.isInteger(v) && v >= 4 && v <= 100 ? v : fallback);
  const cols = limit(state?.grid?.cols, COLS),
    rows = limit(state?.grid?.rows, ROWS);
  return { cols, rows, width: cols * CELL, height: rows * CELL };
}
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const meters = (a, b) => (distance(a, b) / CELL) * UNIT;
export const worldPoint = (p, c) => ({ x: (p.x - c.x) / c.scale, y: (p.y - c.y) / c.scale });
export function zoomAt(c, p, factor) {
  const scale = clamp(c.scale * factor, 0.02, 3.5),
    w = worldPoint(p, c);
  return { scale, x: p.x - w.x * scale, y: p.y - w.y * scale };
}
export function fitCamera(w, h, grid = boardSize()) {
  const scale = clamp(Math.min((w - 36) / grid.width, (h - 36) / grid.height), 0.02, 3.5);
  return { scale, x: (w - grid.width * scale) / 2, y: (h - grid.height * scale) / 2 };
}
export function cellAt(p) {
  return { x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) };
}
export const validCell = ({ x, y }, grid = boardSize()) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
export const center = (t) => ({ x: (t.x + 0.5) * CELL, y: (t.y + 0.5) * CELL });
export const boardPoint = (p, grid = boardSize()) => ({
  x: clamp(p.x, 0, grid.width),
  y: clamp(p.y, 0, grid.height),
});
export function geometry(type, a, b) {
  if (type === 'rect')
    return {
      type,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.max(12, Math.abs(a.x - b.x)),
      h: Math.max(12, Math.abs(a.y - b.y)),
    };
  if (type === 'circle') return { type, x: a.x, y: a.y, r: Math.max(8, distance(a, b)) };
  return { type, x: a.x, y: a.y, x2: b.x, y2: b.y };
}
export function translateShape(s, dx, dy) {
  return {
    ...s,
    x: s.x + dx,
    y: s.y + dy,
    ...(s.type === 'line' ? { x2: s.x2 + dx, y2: s.y2 + dy } : {}),
  };
}
export function resizeShape(s, handle, p) {
  if (s.type === 'circle') return { ...s, r: Math.max(8, distance(s, p)) };
  if (s.type === 'line')
    return handle === 'start' ? { ...s, x: p.x, y: p.y } : { ...s, x2: p.x, y2: p.y };
  const right = s.x + s.w,
    bottom = s.y + s.h;
  const opposite = {
    x: handle.includes('w') ? right : s.x,
    y: handle.includes('n') ? bottom : s.y,
  };
  return { ...s, ...geometry('rect', opposite, p) };
}
export function conePath(a, b) {
  const r = distance(a, b),
    angle = Math.atan2(b.y - a.y, b.x - a.x),
    p = angle - Math.PI / 4,
    q = angle + Math.PI / 4;
  return `M ${a.x} ${a.y} L ${a.x + r * Math.cos(p)} ${a.y + r * Math.sin(p)} A ${r} ${r} 0 0 1 ${a.x + r * Math.cos(q)} ${a.y + r * Math.sin(q)} Z`;
}
