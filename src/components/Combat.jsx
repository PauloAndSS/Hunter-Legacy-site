import { boardSize } from './boardGeometry';
import React, { useState, useEffect } from 'react';
import { Empty } from './UI';
import BattleCanvas from './BattleCanvas';
import { conditions, normalize } from '../rules';
export default function Combat({
  battle,
  gm,
  characters,
  profiles,
  uid,
  records,
  busy,
  command,
  openSheet,
  rollNPC,
}) {
  const [selected, S] = useState(null),
    [npc, N] = useState(''),
    [kind, K] = useState('action'),
    [label, L] = useState('Ataque');
  const state = battle?.state || { tokens: [], round: 1, turn: 0 };
  const tokens = state.tokens || [],
    idx = tokens.findIndex((t) => t.id === selected),
    t = tokens[idx],
    current = tokens[state.turn],
    char = characters.find((c) => c.id === t?.characterId);
  const config = (patch) => command('configure', { ...state, ...patch });
  const patchToken = (patch) =>
    config({ tokens: tokens.map((v, i) => (i === idx ? { ...v, ...patch } : v)) });
  useEffect(() => {
    if (selected !== null && !tokens.some((t) => t.id === selected)) S(null);
  }, [selected, current?.id, tokens.length]);
  function add(c, record) {
    const { cols, rows } = boardSize(state);
    const name = c?.name || record?.title || npc.trim();
    if (!name || tokens.length >= cols * rows || (c && tokens.some((t) => t.characterId === c.id)))
      return;
    const occ = new Set(tokens.map((t) => `${t.x},${t.y}`));
    let i = 0;
    while (i < cols * rows && occ.has(`${i % cols},${Math.floor(i / cols)}`)) i++;
    if (i >= cols * rows) return;
    const s = c
      ? normalize(c.sheet)
      : {
          speed: Number(record?.data?.speed ?? 6),
          pv: Number(record?.data?.hp ?? 10),
          pvMax: Number(record?.data?.hp ?? 10),
          attackBonus: Number(record?.data?.attackBonus ?? 0),
        };
    const id = crypto.randomUUID();
    config({
      tokens: [
        ...tokens,
        {
          id,
          characterId: c?.id || null,
          name,
          x: i % cols,
          y: Math.floor(i / cols),
          speed: s.speed,
          remaining: s.speed,
          attackBonus: s.attackBonus,
          hp: s.pv,
          hpMax: s.pvMax,
          statuses: [],
          action: true,
          power: true,
          reaction: true,
          bonus: false,
        },
      ],
      ...(tokens.length ? {} : { turn: 0 }),
    });
    N('');
    S(id);
  }
  const statusMap = (t) => t.statuses || [];
  return (
    <section className="combat3">
      <div className="combat-heading">
        <div>
          <span className="eyebrow">ENCONTRO TÁTICO</span>
          <h1>Combate</h1>
          <p className="muted">
            {state.active
              ? `Rodada ${state.round} · Turno de ${current?.name || '—'}`
              : 'Preparação do encontro'}
          </p>
        </div>
        <div className="row">
          {gm && (
            <>
              <button
                className="primary"
                disabled={busy || !tokens.length}
                onClick={() =>
                  config({ active: !state.active, moveAllowed: false, reactionFor: null })
                }
              >
                {state.active ? 'Pausar' : 'Iniciar combate'}
              </button>
              <button disabled={busy || !state.active} onClick={() => command('next')}>
                Próximo turno →
              </button>
            </>
          )}
        </div>
      </div>
      {gm && (
        <div className="combat-controls row">
          <select
            aria-label="Adicionar jogador"
            value=""
            disabled={busy}
            onChange={(e) => add(characters.find((c) => c.id === e.target.value))}
          >
            <option value="">+ Personagem</option>
            {characters
              .filter((c) => !tokens.some((t) => t.characterId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            aria-label="Adicionar NPC ou criatura"
            value=""
            disabled={busy}
            onChange={(e) =>
              add(
                null,
                records.find((r) => r.id === e.target.value),
              )
            }
          >
            <option value="">+ NPC / bestiário</option>
            {records
              .filter((r) => ['npc', 'beast'].includes(r.kind))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
          </select>
          <input placeholder="Nome de NPC avulso" value={npc} onChange={(e) => N(e.target.value)} />
          <button disabled={busy || !npc.trim()} onClick={() => add(null)}>
            Adicionar NPC
          </button>
          <button
            disabled={busy || !state.active}
            onClick={() => config({ moveAllowed: !state.moveAllowed })}
          >
            {state.moveAllowed ? 'Bloquear movimento' : 'Liberar movimento'}
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              if (confirm('Limpar todos os tokens e reiniciar o encontro?'))
                config({
                  active: false,
                  tokens: [],
                  turn: 0,
                  round: 1,
                  moveAllowed: false,
                  reactionFor: null,
                });
            }}
          >
            Reiniciar
          </button>
        </div>
      )}
      <div className="combat-workspace">
        <aside className="initiative">
          <h3>Iniciativa</h3>
          <small>Ordem manual do mestre</small>
          {tokens.map((v, i) => (
            <button
              key={v.id}
              onClick={() => S(v.id)}
              className={
                'initiative-row ' +
                (selected === v.id ? 'selected ' : '') +
                (state.active && i === state.turn ? 'current' : '')
              }
            >
              <span>{i + 1}</span>
              <strong>{v.name}</strong>
              <small>{v.remaining} casas</small>
            </button>
          ))}
          {!tokens.length && <p className="muted">Nenhum participante.</p>}
        </aside>
        <BattleCanvas
          battle={battle}
          state={state}
          tokens={tokens}
          characters={characters}
          profiles={profiles}
          uid={uid}
          gm={gm}
          busy={busy}
          command={command}
          config={config}
          selected={selected}
          onSelect={S}
          onOpen={openSheet}
        />
        <aside className="combat-inspector">
          <h3>{t?.name || 'Participante'}</h3>
          {t ? (
            <>
              <small>{char ? 'Personagem de jogador' : 'NPC / Criatura'}</small>
              {char && (
                <button className="primary" onClick={() => openSheet(char, t)}>
                  Abrir ficha lateral →
                </button>
              )}
              <div className="action-state">
                {[
                  ['action', 'Ação'],
                  ['power', 'Poder'],
                  ['bonus', 'Bônus'],
                  ['reaction', 'Reação'],
                ].map(([k, n]) => (
                  <span key={k} className={t[k] ? 'available' : ''}>
                    {n} {t[k] ? '✓' : '—'}
                  </span>
                ))}
              </div>
              {gm && (
                <>
                  <label>
                    PV atuais / máximos
                    <div className="row hp-inputs">
                      <input
                        key={t.id + 'hp' + t.hp}
                        aria-label="PV atuais"
                        type="number"
                        min="0"
                        max={t.hpMax ?? 9999}
                        defaultValue={t.hp ?? (char?.sheet?.pv || 10)}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.min(t.hpMax ?? 9999, +e.target.value || 0));
                          if (v !== t.hp) patchToken({ hp: v });
                        }}
                      />
                      <input
                        key={t.id + 'max' + t.hpMax}
                        aria-label="PV máximos"
                        type="number"
                        min="1"
                        max="9999"
                        defaultValue={t.hpMax ?? (char?.sheet?.pvMax || 10)}
                        onBlur={(e) => {
                          const m = Math.max(1, Math.min(9999, +e.target.value || 1));
                          if (m !== t.hpMax) patchToken({ hpMax: m, hp: Math.min(m, t.hp ?? m) });
                        }}
                      />
                    </div>
                  </label>
                  <div className="status-buttons">
                    {Object.entries(conditions).map(([code, n]) => (
                      <button
                        key={code}
                        title={n}
                        aria-pressed={statusMap(t).includes(code)}
                        className={statusMap(t).includes(code) ? 'active' : ''}
                        disabled={busy}
                        onClick={() =>
                          patchToken({
                            statuses: statusMap(t).includes(code)
                              ? statusMap(t).filter((v) => v !== code)
                              : [...statusMap(t), code],
                          })
                        }
                      >
                        {code} · {n}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={busy || !state.active}
                    onClick={() => config({ reactionFor: idx })}
                  >
                    Liberar reação
                  </button>
                  <button disabled={busy} onClick={() => patchToken({ bonus: true })}>
                    Liberar ação bônus
                  </button>
                  {!char && (
                    <>
                      <label>
                        Bônus de ataque
                        <input
                          key={t.id + 'b' + t.attackBonus}
                          type="number"
                          min="-100"
                          max="100"
                          defaultValue={t.attackBonus || 0}
                          onBlur={(e) => {
                            const v = Math.max(-100, Math.min(100, +e.target.value || 0));
                            if (v !== t.attackBonus) patchToken({ attackBonus: v });
                          }}
                        />
                      </label>
                      <label>
                        Ação
                        <select value={kind} onChange={(e) => K(e.target.value)}>
                          <option value="action">Normal</option>
                          <option value="power">Poder</option>
                          <option value="bonus">Bônus</option>
                          <option value="reaction">Reação</option>
                        </select>
                      </label>
                      <input value={label} maxLength={80} onChange={(e) => L(e.target.value)} />
                      <button
                        disabled={
                          busy ||
                          !state.active ||
                          !t[kind] ||
                          (kind === 'reaction' ? state.reactionFor !== idx : state.turn !== idx)
                        }
                        onClick={() => rollNPC(idx, kind, label)}
                      >
                        ⚄ Rolar d20
                      </button>
                    </>
                  )}
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      const arr = tokens.filter((v) => v.id !== t.id);
                      config({
                        tokens: arr,
                        turn: Math.max(
                          0,
                          Math.min(arr.length - 1, state.turn - (idx < state.turn ? 1 : 0)),
                        ),
                        reactionFor: null,
                        moveAllowed: false,
                        active: arr.length ? state.active : false,
                      });
                    }}
                  >
                    Remover token
                  </button>
                </>
              )}
              {!gm && (
                <p className="muted">Condições e PV do encontro são controlados pelo mestre.</p>
              )}
            </>
          ) : (
            <Empty title="Selecione um token" />
          )}
        </aside>
      </div>
    </section>
  );
}
