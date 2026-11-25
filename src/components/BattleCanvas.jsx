import React, { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { isDiscordAvatar } from '../discord';
import { conditions } from '../rules';
import {
  CELL,
  UNIT,
  clamp,
  distance,
  meters,
  worldPoint,
  zoomAt,
  boardSize,
  fitCamera as fitGridCamera,
  cellAt,
  validCell as isGridCell,
  center,
  boardPoint as clampGridPoint,
  geometry,
  translateShape,
  resizeShape,
  conePath,
} from './boardGeometry';
import './battleCanvas.css';
const TOOLS = [
  ['select', '↖', 'Selecionar'],
  ['pan', '✥', 'Mover câmera'],
  ['ruler', '↔', 'Régua'],
  ['area', '◯', 'Área'],
  ['cone', '◿', 'Cone'],
];
const DRAW = [
  ['circle', '○', 'Círculo'],
  ['rect', '▭', 'Retângulo'],
  ['line', '╱', 'Linha'],
];
const format = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m';
const colorOf = (s) => (/^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : '#c4a46b');
const fallbackLabel = { circle: 'Círculo', rect: 'Retângulo', line: 'Linha' };
const measureTypes = ['ruler', 'area', 'cone'];
const shapeTypes = ['circle', 'rect', 'line'];
function Handle({ x, y, scale, onDown, label }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={6 / scale}
      fill="#f5e9c7"
      stroke="#263b32"
      strokeWidth={1.5 / scale}
      className="bc-handle"
      aria-label={label}
      onPointerDown={onDown}
    />
  );
}
function Shape({ s, selected, scale, editable, onDown, onHandle }) {
  const col = colorOf(s),
    stroke = selected ? '#ffdc85' : col,
    common = { fill: col, fillOpacity: 0.65, stroke, strokeWidth: (selected ? 2.5 : 1.5) / scale };
  const x = s.type === 'rect' ? s.x + s.w / 2 : s.type === 'line' ? (s.x + s.x2) / 2 : s.x,
    y = s.type === 'rect' ? s.y + s.h / 2 : s.type === 'line' ? (s.y + s.y2) / 2 : s.y;
  const handles =
    s.type === 'rect'
      ? [
          ['nw', s.x, s.y],
          ['ne', s.x + s.w, s.y],
          ['sw', s.x, s.y + s.h],
          ['se', s.x + s.w, s.y + s.h],
        ]
      : s.type === 'circle'
        ? [['radius', s.x + s.r, s.y]]
        : [
            ['start', s.x, s.y],
            ['end', s.x2, s.y2],
          ];
  return (
    <g className={editable ? 'bc-shape editable' : 'bc-shape'}>
      <g onPointerDown={onDown}>
        {s.type === 'rect' ? (
          <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={2} {...common} />
        ) : s.type === 'circle' ? (
          <circle cx={s.x} cy={s.y} r={s.r} {...common} />
        ) : (
          <>
            <line
              x1={s.x}
              y1={s.y}
              x2={s.x2}
              y2={s.y2}
              stroke="transparent"
              strokeWidth={Math.max(14, 16 / scale)}
            />
            <line
              x1={s.x}
              y1={s.y}
              x2={s.x2}
              y2={s.y2}
              stroke={stroke}
              strokeWidth={selected ? 9 : 6}
              strokeLinecap="round"
            />
          </>
        )}
        {s.name && (
          <text
            x={x}
            y={y + (s.type === 'line' ? -12 : 5)}
            className="bc-shape-label"
            textAnchor="middle"
            fontSize={17}
          >
            {s.name}
          </text>
        )}
      </g>
      {selected &&
        editable &&
        handles.map(([h, x, y]) => (
          <Handle
            key={h}
            x={x}
            y={y}
            scale={scale}
            label="Redimensionar objeto"
            onDown={(e) => onHandle(e, h)}
          />
        ))}
    </g>
  );
}
function Measurement({ m, scale, onDrag }) {
  if (!m) return null;
  const { a, b, type } = m,
    r = distance(a, b),
    w = 2 / scale;
  const title =
    (type === 'area' ? 'Raio ' : type === 'cone' ? 'Alcance ' : '') + format(meters(a, b));
  const label =
    type === 'area'
      ? { x: a.x, y: a.y - r - 10 / scale }
      : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 12 / scale };
  return (
    <g className="bc-measure">
      <g onPointerDown={(e) => onDrag(e, 'body')} className="bc-measure-body">
        {type === 'ruler' ? (
          <>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="transparent"
              strokeWidth={18 / scale}
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#f6df9b"
              strokeWidth={w}
              strokeDasharray={`${8 / scale} ${5 / scale}`}
            />
          </>
        ) : type === 'area' ? (
          <circle
            cx={a.x}
            cy={a.y}
            r={r}
            fill="#70d28f"
            fillOpacity=".22"
            stroke="#9be9a8"
            strokeWidth={w}
          />
        ) : (
          <path
            d={conePath(a, b)}
            fill="#75c8e8"
            fillOpacity=".25"
            stroke="#a3e3ff"
            strokeWidth={w}
          />
        )}
        <rect
          x={label.x - 54 / scale}
          y={label.y - 11 / scale}
          width={108 / scale}
          height={23 / scale}
          rx={4 / scale}
          fill="#142e25"
          stroke="#d8bb72"
          strokeWidth={1 / scale}
        />
        <text
          x={label.x}
          y={label.y + 4 / scale}
          fontSize={12 / scale}
          textAnchor="middle"
          fill="#fff3d1"
          pointerEvents="none"
        >
          {title}
        </text>
      </g>
      <Handle
        x={a.x}
        y={a.y}
        scale={scale}
        onDown={(e) => onDrag(e, 'a')}
        label="Arrastar origem"
      />
      <Handle
        x={b.x}
        y={b.y}
        scale={scale}
        onDown={(e) => onDrag(e, 'b')}
        label="Arrastar alcance"
      />
    </g>
  );
}
function Token({ v, c, p, active, selected, movable, position, onDown, onOpen, clipId }) {
  const { x, y } = position || center(v),
    hp = Number(v.hp ?? 10),
    max = Math.max(1, Number(v.hpMax ?? 10)),
    ratio = clamp(hp / max, 0, 1),
    nick = v.characterId ? p?.nickname || c?.name || v.name : v.name;
  const url = p?.avatar_url,
    allowed = isDiscordAvatar(url);
  const name = nick || '?';
  const short = name.length > 16 ? name.slice(0, 15) + '…' : name;
  const npcName = v.name || 'NPC',
    npcLines =
      npcName.length > 10
        ? [npcName.slice(0, 10), npcName.slice(10, 19) + (npcName.length > 19 ? '…' : '')]
        : [npcName];
  const codes = v.statuses || [];
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={'bc-token ' + (movable ? 'movable' : '')}
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${hp} de ${max} PV`}
      onPointerDown={onDown}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onOpen?.();
        }
      }}
    >
      <title>
        {name} · {hp}/{max} PV
        {codes.length ? ' · ' + codes.map((k) => conditions[k] || k).join(', ') : ''}
      </title>
      <defs>
        <clipPath id={clipId}>
          <circle r="38" />
        </clipPath>
      </defs>
      {active && (
        <circle r="46" fill="none" stroke="#f7d77b" strokeWidth="3" strokeDasharray="5 3" />
      )}
      {selected && <circle r="43" fill="none" stroke="#fff0bc" strokeWidth="2.5" />}
      <circle
        r="39"
        fill={v.characterId ? '#315a48' : '#805145'}
        stroke={v.characterId ? '#c6dca8' : '#eabda2'}
        strokeWidth="3"
      />
      {v.characterId ? (
        <>
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="24"
            fontWeight="bold"
            fill="#f6e9c6"
          >
            {name.slice(0, 2).toUpperCase()}
          </text>
          {allowed && (
            <image
              href={url}
              x="-38"
              y="-38"
              width="76"
              height="76"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
            />
          )}
        </>
      ) : (
        npcLines.map((line, i) => (
          <text
            key={i}
            x="0"
            y={(i - (npcLines.length - 1) / 2) * 13 + 4}
            fontSize="11"
            textAnchor="middle"
            fontWeight="700"
            fill="#fff1d7"
          >
            {line}
          </text>
        ))
      )}
      <rect
        x="-37"
        y="-49"
        width="74"
        height="8"
        rx="3"
        fill="#442c29"
        stroke="#182e25"
        strokeWidth="1.5"
      />
      <rect
        x="-36"
        y="-48"
        width={72 * ratio}
        height="6"
        rx="2"
        fill={ratio > 0.5 ? '#a6d77c' : ratio > 0.2 ? '#e5b66d' : '#e07c70'}
      />
      {codes.map((code, i) => (
        <g
          key={code}
          transform={`translate(${((i % 6) - (Math.min(codes.length - i + (i % 6), 6) - 1) / 2) * 15} ${-59 - Math.floor(i / 6) * 15})`}
        >
          <title>{conditions[code] || code}</title>
          <rect
            x="-7"
            y="-7"
            width="14"
            height="14"
            rx="3"
            fill="#874d40"
            stroke="#f0d4a6"
            strokeWidth=".8"
          />
          <text textAnchor="middle" y="3" fontSize="8" fill="white" fontWeight="bold">
            {code}
          </text>
        </g>
      ))}
      <text textAnchor="middle" y="51" className="bc-token-label" fontSize="13">
        {short}
      </text>
    </g>
  );
}
function ObjectEditor({ shape, onSave, onRemove, busy }) {
  const [draft, D] = useState(shape);
  useEffect(
    () => D(shape),
    [
      shape.id,
      shape.name,
      shape.color,
      shape.x,
      shape.y,
      shape.x2,
      shape.y2,
      shape.w,
      shape.h,
      shape.r,
    ],
  );
  return (
    <form
      className="bc-object-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...shape, name: (draft.name || '').trim().slice(0, 60), color: draft.color });
      }}
    >
      <label>
        Nome do objeto
        <input
          maxLength={60}
          value={draft.name || ''}
          onChange={(e) => D({ ...draft, name: e.target.value })}
          placeholder="Ex.: Mesa"
        />
      </label>
      <label>
        Cor base
        <input
          type="color"
          value={colorOf(draft)}
          onChange={(e) => D({ ...draft, color: e.target.value })}
        />
      </label>
      <span className="bc-object-dim">
        {shape.type === 'rect'
          ? `${format((shape.w / CELL) * UNIT)} × ${format((shape.h / CELL) * UNIT)}`
          : shape.type === 'circle'
            ? 'Raio ' + format((shape.r / CELL) * UNIT)
            : format(meters(shape, { x: shape.x2, y: shape.y2 }))}
      </span>
      <button type="submit" disabled={busy}>
        Salvar
      </button>
      <button type="button" className="bc-delete" disabled={busy} onClick={onRemove}>
        Excluir objeto
      </button>
    </form>
  );
}
export default function BattleCanvas({
  battle,
  state,
  tokens,
  characters,
  profiles,
  uid,
  gm,
  busy,
  command,
  config,
  selected,
  onSelect,
  onOpen,
}) {
  const svg = useRef(null),
    drag = useRef(null),
    space = useRef(false),
    cameraRef = useRef(null),
    initialFit = useRef(false),
    lastTap = useRef(null),
    patternId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [size, Size] = useState({ w: 900, h: 580 }),
    [cam, Cam] = useState({ x: 0, y: 0, scale: 0.65 }),
    [tool, Tool] = useState('select'),
    [gesture, Gesture] = useState(null),
    [measure, Measure] = useState(null),
    [shapeId, ShapeId] = useState(null),
    [message, Message] = useState(''),
    [full, Full] = useState(false),
    [snap, Snap] = useState(false);
  const grid = boardSize(state),
    { cols: COLS, rows: ROWS, width: WIDTH, height: HEIGHT } = grid;
  const fitCamera = (w, h) => fitGridCamera(w, h, grid),
    validCell = (p) => isGridCell(p, grid),
    boardPoint = (p) => clampGridPoint(p, grid);
  const shapes = Array.isArray(state.shapes) ? state.shapes : [],
    selectedShape = shapes.find((s) => s.id === shapeId),
    current = tokens[state.turn];
  cameraRef.current = cam;
  const setCamera = (c) => {
    cameraRef.current = c;
    Cam(c);
  };
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    initialFit.current = false;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      Size({ w: r.width, h: r.height });
      if (!initialFit.current) {
        initialFit.current = true;
        setCamera(fitCamera(r.width, r.height));
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [COLS, ROWS]);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [full]);
  useEffect(() => {
    const clear = () => {
      space.current = false;
    };
    window.addEventListener('blur', clear);
    return () => window.removeEventListener('blur', clear);
  }, []);
  const local = (e) => {
    const r = svg.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const point = (e) => worldPoint(local(e), cameraRef.current);
  const drawPoint = (e) => {
    const p = boardPoint(point(e));
    return snap ? { x: Math.round(p.x / CELL) * CELL, y: Math.round(p.y / CELL) * CELL } : p;
  };
  const canMove = (v, i) =>
    gm ||
    !!(
      state.active &&
      state.moveAllowed &&
      i === state.turn &&
      characters.find((c) => c.id === v.characterId)?.owner === uid
    );
  function start(e, d) {
    if (drag.current || e.button === 2) return;
    e.stopPropagation();
    e.preventDefault();
    svg.current.focus({ preventScroll: true });
    svg.current.setPointerCapture(e.pointerId);
    drag.current = {
      ...d,
      pointer: e.pointerId,
      start: point(e),
      screen: local(e),
      revision: battle.revision,
      changed: false,
    };
    Gesture(drag.current);
    Message('');
  }
  function panStart(e) {
    start(e, { type: 'pan', camera: { ...cameraRef.current } });
  }
  function background(e) {
    if (e.button === 1 || tool === 'pan' || space.current) {
      panStart(e);
      return;
    }
    if (e.button !== 0) return;
    if (measureTypes.includes(tool)) {
      const p = drawPoint(e);
      const m = { type: tool, a: p, b: p };
      Measure(m);
      start(e, { type: 'measure-create', value: m });
      return;
    }
    if (gm && shapeTypes.includes(tool) && !busy) {
      const p = drawPoint(e);
      start(e, {
        type: 'shape-create',
        origin: p,
        value: { ...geometry(tool, p, p), name: fallbackLabel[tool], color: '#c4a46b' },
      });
      return;
    }
    ShapeId(null);
    onSelect(null);
    panStart(e);
  }
  function tokenDown(e, v, i) {
    if (e.button === 1 || tool === 'pan' || space.current) {
      panStart(e);
      return;
    }
    if (tool !== 'select') {
      background(e);
      return;
    }
    if (e.button !== 0) return;
    onSelect(v.id);
    ShapeId(null);
    if (!busy && canMove(v, i)) {
      start(e, { type: 'token', id: v.id, original: center(v), value: center(v) });
    } else {
      e.stopPropagation();
      Message('Movimento depende do turno e da autorização do mestre.');
    }
  }
  function shapeDown(e, s, h) {
    if (e.button === 1 || tool === 'pan' || space.current) {
      panStart(e);
      return;
    }
    if (tool !== 'select') {
      background(e);
      return;
    }
    if (e.button !== 0) return;
    if (!gm) {
      background(e);
      return;
    }
    ShapeId(s.id);
    onSelect(null);
    if (!busy)
      start(e, {
        type: h ? 'shape-resize' : 'shape-move',
        id: s.id,
        handle: h,
        original: s,
        value: s,
      });
    else e.stopPropagation();
  }
  function measureDown(e, h) {
    if (e.button === 1 || tool === 'pan' || space.current) {
      panStart(e);
      return;
    }
    if (e.button !== 0) return;
    start(e, { type: 'measure-edit', handle: h, original: measure, value: measure });
  }
  function move(e) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const p = point(e),
      l = local(e),
      dx = p.x - d.start.x,
      dy = p.y - d.start.y;
    d.changed = d.changed || distance(l, d.screen) > 3;
    if (d.type === 'pan') {
      setCamera({
        ...d.camera,
        x: d.camera.x + l.x - d.screen.x,
        y: d.camera.y + l.y - d.screen.y,
      });
      return;
    }
    if (d.type === 'token')
      d.value = {
        x: clamp(d.original.x + dx, CELL / 2, WIDTH - CELL / 2),
        y: clamp(d.original.y + dy, CELL / 2, HEIGHT - CELL / 2),
      };
    if (d.type === 'shape-create')
      d.value = { ...d.value, ...geometry(d.value.type, d.origin, drawPoint(e)) };
    if (d.type === 'shape-move')
      d.value = translateShape(
        d.original,
        snap ? Math.round(dx / CELL) * CELL : dx,
        snap ? Math.round(dy / CELL) * CELL : dy,
      );
    if (d.type === 'shape-resize') d.value = resizeShape(d.original, d.handle, drawPoint(e));
    if (d.type === 'measure-create') d.value = { ...d.value, b: drawPoint(e) };
    if (d.type === 'measure-edit') {
      const m = d.original;
      d.value =
        d.handle === 'body'
          ? { ...m, a: { x: m.a.x + dx, y: m.a.y + dy }, b: { x: m.b.x + dx, y: m.b.y + dy } }
          : { ...m, [d.handle]: drawPoint(e) };
    }
    if (d.type.startsWith('measure')) Measure(d.value);
    Gesture({ ...d });
  }
  function finish(e, cancel = false) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    Gesture(null);
    if (svg.current.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId);
    if (cancel) {
      if (d.type === 'measure-create') Measure(null);
      if (d.type === 'measure-edit') Measure(d.original);
      return;
    }
    if (!d.changed) {
      if (d.type === 'token') {
        const now = performance.now(),
          previous = lastTap.current;
        lastTap.current = { id: d.id, time: now };
        if (previous?.id === d.id && now - previous.time < 350) {
          const t = tokens.find((v) => v.id === d.id),
            c = characters.find((v) => v.id === t?.characterId);
          if (c) {
            Full(false);
            onOpen(c, t);
          }
          lastTap.current = null;
        }
      }
      if (d.type === 'measure-create')
        Measure({ ...d.value, b: { x: d.value.a.x + CELL, y: d.value.a.y } });
      return;
    }
    if (d.type === 'pan' || d.type.startsWith('measure')) return;
    if (busy || battle.revision !== d.revision) {
      Message('O combate mudou durante o arraste. Tente novamente.');
      return;
    }
    if (d.type === 'token') {
      const i = tokens.findIndex((v) => v.id === d.id),
        v = tokens[i],
        dest = cellAt(d.value);
      if (i < 0 || !canMove(v, i) || !validCell(dest)) return;
      if (v.x === dest.x && v.y === dest.y) return;
      if (tokens.some((t) => t.id !== v.id && t.x === dest.x && t.y === dest.y)) {
        Message('Essa casa já está ocupada.');
        return;
      }
      command('move', { index: i, ...dest });
      return;
    }
    if (!gm) return;
    if (d.type === 'shape-create') {
      if (shapes.length >= 100) {
        Message('Limite de 100 objetos neste cenário.');
        return;
      }
      const s = { ...d.value, id: crypto.randomUUID() };
      ShapeId(s.id);
      Tool('select');
      config({ shapes: [...shapes, s] });
      return;
    }
    config({ shapes: shapes.map((s) => (s.id === d.id ? d.value : s)) });
  }
  function changeTool(k) {
    Tool(k);
    Message('');
    if (measureTypes.includes(k) && measure?.type !== k) Measure(null);
    if (k !== 'select') ShapeId(null);
  }
  function zoom(f) {
    setCamera(zoomAt(cameraRef.current, { x: size.w / 2, y: size.h / 2 }, f));
  }
  function removeShape() {
    if (gm && selectedShape && !busy) {
      config({ shapes: shapes.filter((s) => s.id !== shapeId) });
      ShapeId(null);
    }
  }
  function key(e) {
    if (e.key === ' ') {
      e.preventDefault();
      space.current = true;
    }
    if (e.key === 'Escape') {
      Measure(null);
      ShapeId(null);
      if (full) Full(false);
    }
    if (e.key === 'Delete' && gm && selectedShape) {
      e.preventDefault();
      removeShape();
    }
    if (e.key === '+' || e.key === '=') zoom(1.2);
    if (e.key === '-') zoom(1 / 1.2);
    const offset = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[
      e.key
    ];
    if (offset) {
      e.preventDefault();
      const i = tokens.findIndex((t) => t.id === selected),
        t = tokens[i];
      if (tool === 'select' && t && !busy && canMove(t, i)) {
        const dest = { x: t.x + offset[0], y: t.y + offset[1] };
        if (
          validCell(dest) &&
          !tokens.some((v) => v.id !== t.id && v.x === dest.x && v.y === dest.y)
        )
          command('move', { index: i, ...dest });
      } else
        setCamera({ ...cameraRef.current, x: cam.x - offset[0] * 40, y: cam.y - offset[1] * 40 });
    }
  }
  const chosenToken = tokens.find((t) => t.id === selected),
    chosenChar = characters.find((c) => c.id === chosenToken?.characterId);
  const openCharacter = (c, t) => {
    Full(false);
    onOpen(c, t);
  };
  const preview = gesture?.type === 'shape-create' ? gesture.value : null,
    renderShapes = shapes.map((s) =>
      gesture?.id === s.id && gesture.type.startsWith('shape') ? gesture.value : s,
    );
  const help =
    tool === 'select'
      ? 'Arraste um token para mover · arraste o fundo para navegar.'
      : tool === 'pan'
        ? 'Arraste para mover a câmera.'
        : measureTypes.includes(tool)
          ? 'Clique e arraste para medir. Depois arraste o centro ou as extremidades.'
          : 'Clique e arraste para desenhar; selecione o objeto para editar nome e cor.';
  return (
    <div className={'battle-center bc-root ' + (full ? 'bc-full' : '')}>
      <div className="bc-top">
        <span className="bc-title">⌖ Tabuleiro tático</span>
        <span className="bc-meta">
          {COLS} × {ROWS} · {UNIT.toLocaleString('pt-BR')} m / casa
        </span>
        {chosenChar && (
          <button type="button" onClick={() => openCharacter(chosenChar, chosenToken)}>
            Abrir ficha
          </button>
        )}
        <button
          type="button"
          onClick={() => Full(!full)}
          title={full ? 'Sair da tela ampliada' : 'Ampliar tabuleiro'}
        >
          {full ? '↙ Reduzir' : '⛶ Ampliar'}
        </button>
      </div>
      <div className="bc-toolbar" role="toolbar" aria-label="Ferramentas de combate">
        <div className="bc-toolgroup">
          {TOOLS.map(([k, i, n]) => (
            <button
              type="button"
              key={k}
              aria-pressed={tool === k}
              title={n}
              className={tool === k ? 'active' : ''}
              onClick={() => changeTool(k)}
            >
              <b>{i}</b>
              <span>{n}</span>
            </button>
          ))}
        </div>
        {gm && (
          <div className="bc-toolgroup" aria-label="Objetos de cenário">
            {DRAW.map(([k, i, n]) => (
              <button
                type="button"
                key={k}
                aria-pressed={tool === k}
                title={n}
                className={tool === k ? 'active' : ''}
                disabled={busy}
                onClick={() => changeTool(k)}
              >
                <b>{i}</b>
                <span>{n}</span>
              </button>
            ))}
          </div>
        )}
        <div className="bc-toolgroup bc-camera">
          <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Diminuir zoom">
            −
          </button>
          <span>{Math.round(cam.scale * 100)}%</span>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Aumentar zoom">
            +
          </button>
          <button type="button" onClick={() => setCamera(fitCamera(size.w, size.h))}>
            Enquadrar
          </button>
        </div>
      </div>
      {gm && (
        <form
          key={`${COLS}x${ROWS}`}
          className="bc-grid-edit"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || drag.current) return;
            const data = new FormData(e.currentTarget),
              cols = Number(data.get('cols')),
              rows = Number(data.get('rows'));
            if (
              !Number.isInteger(cols) ||
              !Number.isInteger(rows) ||
              cols < 4 ||
              cols > 100 ||
              rows < 4 ||
              rows > 100
            ) {
              Message('Use de 4 a 100 casas por dimensão.');
              return;
            }
            if (tokens.some((t) => t.x < 0 || t.y < 0 || t.x >= cols || t.y >= rows)) {
              Message('Mova os tokens para dentro do novo grid antes de reduzir.');
              return;
            }
            if (cols !== COLS || rows !== ROWS) {
              Measure(null);
              config({ grid: { cols, rows } });
            }
          }}
        >
          <span className="bc-grid-label">Tamanho do grid</span>
          <label>
            Colunas
            <input
              name="cols"
              type="number"
              min="4"
              max="100"
              step="1"
              required
              defaultValue={COLS}
            />
          </label>
          <label>
            Linhas
            <input
              name="rows"
              type="number"
              min="4"
              max="100"
              step="1"
              required
              defaultValue={ROWS}
            />
          </label>
          <button type="submit" disabled={busy || !!gesture}>
            Aplicar grid
          </button>
        </form>
      )}
      {gm && (
        <div className="bc-options">
          <label>
            <input type="checkbox" checked={snap} onChange={(e) => Snap(e.target.checked)} />{' '}
            Alinhar desenhos à grade
          </label>
          <span>{shapes.length}/100 objetos</span>
          {measure && (
            <button type="button" onClick={() => Measure(null)}>
              Limpar medida
            </button>
          )}
        </div>
      )}
      {!gm && measure && (
        <div className="bc-options">
          <button type="button" onClick={() => Measure(null)}>
            Limpar medida
          </button>
        </div>
      )}
      <svg
        ref={svg}
        className={'bc-viewport tool-' + tool + (gesture?.type === 'pan' ? ' panning' : '')}
        viewBox={`0 0 ${size.w} ${size.h}`}
        tabIndex={0}
        aria-label="Tabuleiro de combate interativo"
        onPointerDown={background}
        onPointerMove={move}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => {
          if (drag.current?.pointer === e.pointerId) finish(e, true);
        }}
        onKeyDown={key}
        onKeyUp={(e) => {
          if (e.key === ' ') space.current = false;
        }}
        onBlur={() => {
          space.current = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id={patternId + 'grid'} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <rect width={CELL} height={CELL} fill="#4a5b51" />
            <path d={`M ${CELL} 0 H 0 V ${CELL}`} stroke="#243d34" strokeWidth="2" fill="none" />
          </pattern>
          <pattern id={patternId + 'dots'} width="25" height="25" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#52695c" />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill="#192e28" />
        <rect width={size.w} height={size.h} fill={`url(#${patternId}dots)`} />
        <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.scale})`}>
          <rect
            x="0"
            y="0"
            width={WIDTH}
            height={HEIGHT}
            fill={`url(#${patternId}grid)`}
            stroke="#839079"
            strokeWidth="2"
          />
          {renderShapes.map((s) => (
            <Shape
              key={s.id}
              s={s}
              selected={s.id === shapeId}
              scale={cam.scale}
              editable={gm && tool === 'select'}
              onDown={(e) => shapeDown(e, s)}
              onHandle={(e, h) => shapeDown(e, s, h)}
            />
          ))}
          {preview && (
            <g pointerEvents="none">
              <Shape s={preview} scale={cam.scale} />
            </g>
          )}
          {gesture?.type === 'token' &&
            (() => {
              const d = cellAt(gesture.value),
                occupied = tokens.some((t) => t.id !== gesture.id && t.x === d.x && t.y === d.y);
              return (
                <rect
                  x={d.x * CELL + 2}
                  y={d.y * CELL + 2}
                  width={CELL - 4}
                  height={CELL - 4}
                  fill={occupied ? '#b34c4c55' : '#e6c97b44'}
                  stroke={occupied ? '#ef7777' : '#f6d887'}
                  strokeWidth="3"
                  pointerEvents="none"
                />
              );
            })()}
          {tokens.map((v, i) => {
            const c = characters.find((c) => c.id === v.characterId);
            return (
              <Token
                key={v.id}
                v={v}
                c={c}
                p={profiles[c?.owner]}
                active={state.active && current?.id === v.id}
                selected={selected === v.id}
                movable={canMove(v, i)}
                position={gesture?.type === 'token' && gesture.id === v.id ? gesture.value : null}
                clipId={patternId + 'token' + i}
                onDown={(e) => tokenDown(e, v, i)}
                onOpen={() => {
                  onSelect(v.id);
                  if (c) openCharacter(c, v);
                }}
              />
            );
          })}
          {measure && <Measurement m={measure} scale={cam.scale} onDrag={measureDown} />}
        </g>
      </svg>
      <div className="bc-footer">
        <span>{message || help}</span>
        <small>Zoom: + / − · Espaço + arraste: câmera</small>
      </div>
      {gm && selectedShape && (
        <ObjectEditor
          shape={selectedShape}
          busy={busy}
          onSave={(s) => config({ shapes: shapes.map((v) => (v.id === s.id ? s : v)) })}
          onRemove={removeShape}
        />
      )}
    </div>
  );
}
