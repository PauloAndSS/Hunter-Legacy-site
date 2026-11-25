import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zoomAt,
  worldPoint,
  fitCamera,
  geometry,
  resizeShape,
  translateShape,
  cellAt,
  validCell,
  meters,
  conePath,
} from '../src/components/boardGeometry.js';
test('zoom anchors the pointer', () => {
  const c = { x: 50, y: -20, scale: 0.8 },
    p = { x: 200, y: 350 },
    before = worldPoint(p, c),
    after = worldPoint(p, zoomAt(c, p, 1.8));
  assert.ok(Math.abs(before.x - after.x) < 1e-8);
  assert.ok(Math.abs(before.y - after.y) < 1e-8);
});
test('fit and cell positions', () => {
  assert.ok(fitCamera(900, 580).scale > 0);
  assert.deepEqual(cellAt({ x: 1199, y: 799 }), { x: 11, y: 7 });
  assert.equal(validCell({ x: 12, y: 7 }), false);
  assert.equal(validCell({ x: 0, y: 0 }), true);
});
test('rectangle creation and resize', () => {
  let r = geometry('rect', { x: 400, y: 300 }, { x: 100, y: 100 });
  assert.deepEqual(r, { type: 'rect', x: 100, y: 100, w: 300, h: 200 });
  assert.deepEqual(resizeShape(r, 'nw', { x: 50, y: 60 }), {
    type: 'rect',
    x: 50,
    y: 60,
    w: 350,
    h: 240,
  });
});
test('line moves both ends', () => {
  assert.deepEqual(translateShape({ type: 'line', x: 10, y: 20, x2: 30, y2: 40 }, 100, -10), {
    type: 'line',
    x: 110,
    y: 10,
    x2: 130,
    y2: 30,
  });
});
test('ruler and cone geometry', () => {
  assert.equal(meters({ x: 0, y: 0 }, { x: 300, y: 400 }), 7.5);
  assert.match(conePath({ x: 0, y: 0 }, { x: 100, y: 0 }), /A 100 100 0 0 1/);
});
