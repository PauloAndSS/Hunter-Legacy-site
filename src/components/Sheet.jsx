import React, { useState } from 'react';
import { Avatar, Meter, Modal } from './UI';
import {
  attrs,
  catalogs,
  skills,
  attrCodes,
  normalize,
  mod,
  prof,
  signed,
  skillBonus,
} from '../rules';
export default function Sheet({
  character,
  profile,
  canEdit,
  isOwner = false,
  isNew,
  onClose,
  onSave,
  onRoll,
  onShare,
  onDelete,
  campaigns,
  exportedTo = [],
  drawer = false,
  token,
  busy = false,
  canRoll = true,
  combatActive = false,
  allowedKinds = [],
}) {
  const [editing, E] = useState(isNew),
    [draft, D] = useState(() => ({ ...normalize(character.sheet), name: character.name || '' })),
    [tab, T] = useState('Resumo'),
    [kind, K] = useState('action'),
    [share, S] = useState(''),
    [baseRevision, BR] = useState(character.revision),
    [err, ER] = useState('');
  const s = editing ? draft : normalize(character.sheet);
  const set = (key, value) => D((old) => ({ ...old, [key]: value }));
  const field = (k, label, min = 0, max = 9999) => (
    <label key={k}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        required
        value={draft[k]}
        onChange={(e) => set(k, +e.target.value)}
      />
    </label>
  );
  const select = (k, label, cat) => (
    <label key={k}>
      {label}
      <select value={draft[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">Selecione</option>
        {(catalogs[cat] || []).map((v) => (
          <option key={v.id}>{v.name}</option>
        ))}
      </select>
    </label>
  );
  const permitted = (k) => canRoll && !busy && (!combatActive || allowedKinds.includes(k));
  const roll = (mode, key) =>
    onRoll(
      character,
      mode,
      key,
      mode === 'technique' && combatActive ? s.techniques[Number(key)]?.kind || kind : kind,
    );
  async function save(e) {
    e.preventDefault();
    ER('');
    try {
      if (!draft.name.trim()) throw Error('Informe o nome.');
      for (const k of ['pv', 'pve', 'pa'])
        if (draft[k] > draft[k + 'Max']) throw Error('O valor atual não pode exceder o máximo.');
      await onSave(draft, character, baseRevision);
      E(false);
    } catch (e) {
      ER(e.message);
    }
  }
  return (
    <Modal
      title={isNew ? 'Criar ficha' : editing ? 'Editar ficha' : 'Ficha de personagem'}
      onClose={onClose}
      wide={!drawer}
      drawer={drawer}
    >
      <div className="sheet3">
        <header className="sheet-hero">
          <Avatar profile={profile} fallback={s.name || character.name} size={96} />
          <div>
            <small>REGISTRO DA ASSOCIAÇÃO</small>
            <h1>{editing ? draft.name || 'Novo Hunter' : character.name}</h1>
            <p>
              {s.hunter || 'Hunter'} · {s.nen || 'Nen não definido'}
            </p>
          </div>
          <div className="level-disc">
            <small>NÍVEL</small>
            <strong>{s.level}</strong>
          </div>
        </header>
        {editing ? (
          <form className="sheet-edit" onSubmit={save}>
            <div className="fields">
              <label>
                Nome do personagem
                <input
                  required
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Nome"
                />
              </label>
              {field('level', 'Nível', 1, 30)}
              {select('species', 'Espécie', 'especies')}
              {select('nen', 'Categoria de Nen', 'categorias_nen')}
              {select('hunter', 'Classe Hunter', 'classes_hunter')}
              {select('origin', 'Origem', 'origens')}
              {field('pv', 'PV atual')}
              {field('pvMax', 'PV máximo', 1)}
              {field('pve', 'PVE atual')}
              {field('pveMax', 'PVE máximo', 1)}
              {field('pa', 'PA atual')}
              {field('paMax', 'PA máximo')}
              {field('cr', 'Classe de resistência', 0, 100)}
              {field('speed', 'Deslocamento (casas)', 0, 96)}
              {field('attackBonus', 'Bônus de ataque', -100, 100)}
              {draft.level > 20 && (
                <label>
                  Proficiência épica (manual)
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={draft.proficiency ?? 6}
                    onChange={(e) => set('proficiency', +e.target.value)}
                  />
                </label>
              )}
            </div>
            <h3>Atributos</h3>
            <div className="fields">
              {attrs.map((a) => (
                <label key={a}>
                  {a}
                  <input
                    required
                    type="number"
                    min="1"
                    max="30"
                    value={draft.attributes[a]}
                    onChange={(e) =>
                      set('attributes', { ...draft.attributes, [a]: +e.target.value })
                    }
                  />
                  <small>Modificador {signed(mod(draft.attributes[a]))}</small>
                </label>
              ))}
            </div>
            <h3>Perícias e salvaguardas</h3>
            <div className="fields">
              {skills.map((k) => (
                <label key={k.id}>
                  {k.name}
                  <select
                    value={draft.skillTraining[k.id] || 0}
                    onChange={(e) =>
                      set('skillTraining', { ...draft.skillTraining, [k.id]: +e.target.value })
                    }
                  >
                    <option value="0">Sem proficiência</option>
                    <option value="1">Proficiente</option>
                    <option value="2">Maestria</option>
                  </select>
                </label>
              ))}
            </div>
            <div className="fields">
              {attrs.map((a) => (
                <label className="inline" key={a}>
                  <input
                    type="checkbox"
                    checked={!!draft.saves[a]}
                    onChange={(e) => set('saves', { ...draft.saves, [a]: e.target.checked })}
                  />
                  {a} (salvaguarda)
                </label>
              ))}
            </div>
            <h3>Técnicas e ataques personalizados</h3>
            {draft.techniques.map((t, i) => (
              <div className="fields technique-edit" key={i}>
                <label>
                  Nome
                  <input
                    required
                    maxLength={80}
                    value={t.name}
                    onChange={(e) =>
                      set(
                        'techniques',
                        draft.techniques.map((v, j) =>
                          j === i ? { ...v, name: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Bônus d20
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={t.bonus}
                    onChange={(e) =>
                      set(
                        'techniques',
                        draft.techniques.map((v, j) =>
                          j === i ? { ...v, bonus: +e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={t.kind}
                    onChange={(e) =>
                      set(
                        'techniques',
                        draft.techniques.map((v, j) =>
                          j === i ? { ...v, kind: e.target.value } : v,
                        ),
                      )
                    }
                  >
                    <option value="action">Normal</option>
                    <option value="power">Poder</option>
                    <option value="bonus">Bônus</option>
                    <option value="reaction">Reação</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      'techniques',
                      draft.techniques.filter((_, j) => j !== i),
                    )
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                set('techniques', [...draft.techniques, { name: '', bonus: 0, kind: 'power' }])
              }
            >
              + Adicionar técnica
            </button>
            <label>
              Hatsu, inventário e anotações
              <textarea
                rows="5"
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>
            {err && <p className="error">{err}</p>}
            <div className="row sheet-save">
              <button className="primary" disabled={busy}>
                Salvar ficha
              </button>
              <button type="button" onClick={() => (isNew ? onClose() : E(false))}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="sheet-actions row">
              <span className="muted">Modo leitura · Clique em um valor para rolar</span>
              {canEdit && (
                <button
                  onClick={() => {
                    ER('');
                    BR(character.revision);
                    D({ ...normalize(character.sheet), name: character.name });
                    E(true);
                  }}
                >
                  ✎ Editar
                </button>
              )}
              {combatActive && (
                <label className="roll-kind">
                  Usar
                  <select value={kind} onChange={(e) => K(e.target.value)}>
                    <option value="action">Ação</option>
                    <option value="power">Poder</option>
                    <option value="bonus">Bônus</option>
                    <option value="reaction">Reação</option>
                  </select>
                </label>
              )}
            </div>
            {combatActive && (
              <p className="sheet-hint">
                {allowedKinds.length
                  ? `Ações disponíveis: ${allowedKinds.map((k) => ({ action: 'normal', power: 'poder', bonus: 'bônus', reaction: 'reação' })[k]).join(', ')}. Selecione o tipo correto.`
                  : 'Aguarde seu turno ou uma reação autorizada pelo mestre.'}
              </p>
            )}
            <div className="attribute-strip">
              {attrs.map((a) => (
                <button key={a} disabled={!permitted(kind)} onClick={() => roll('attribute', a)}>
                  <small>{a}</small>
                  <strong>{signed(mod(s.attributes[a]))}</strong>
                  <span>{s.attributes[a]}</span>
                </button>
              ))}
            </div>
            <nav className="sheet-tabs" aria-label="Seções da ficha">
              {['Resumo', 'Técnicas', 'Anotações'].map((t) => (
                <button key={t} className={tab === t ? 'active' : ''} onClick={() => T(t)}>
                  {t}
                </button>
              ))}
            </nav>
            {tab === 'Resumo' && (
              <div className="sheet-layout">
                <aside className="sheet-vitals">
                  <Avatar profile={profile} fallback={character.name} size={150} />
                  <div className="stat-diamond">
                    <small>CR</small>
                    <strong>{s.cr}</strong>
                  </div>
                  <div className="mini-stats">
                    <button
                      disabled={!permitted(kind)}
                      onClick={() => roll('attribute', 'Agilidade')}
                    >
                      <small>Iniciativa</small>
                      <b>{signed(mod(s.attributes.Agilidade))}</b>
                    </button>
                    <div>
                      <small>Proficiência</small>
                      <b>{signed(prof(s))}</b>
                    </div>
                    <div>
                      <small>Deslocamento</small>
                      <b>{s.speed} casas</b>
                    </div>
                  </div>
                  <Meter
                    label="Pontos de vida"
                    value={token?.hp ?? s.pv}
                    max={token?.hpMax ?? s.pvMax}
                  />
                  <Meter label="Vitalidade" value={s.pve} max={s.pveMax} color="#b78748" />
                  <Meter label="Aura" value={s.pa} max={s.paMax} color="#8263aa" />
                  <button
                    className="primary"
                    disabled={
                      !permitted(kind) || (combatActive && !['action', 'reaction'].includes(kind))
                    }
                    onClick={() => roll('attack', '')}
                  >
                    ⚄ Ataque {signed(s.attackBonus)}
                  </button>
                </aside>
                <section className="sheet-skills">
                  <h3>Perícias</h3>
                  {skills.map((k) => (
                    <button
                      disabled={!permitted(kind)}
                      key={k.id}
                      onClick={() => roll('skill', k.id)}
                      className="skill-row"
                    >
                      <span className={s.skillTraining[k.id] ? 'trained' : ''}>
                        {s.skillTraining[k.id] === 2 ? '◉' : s.skillTraining[k.id] ? '●' : '○'}
                      </span>
                      <small>{k.attribute}</small>
                      <span>{k.name}</span>
                      <b>{signed(skillBonus(s, k))}</b>
                      <span>⚄</span>
                    </button>
                  ))}
                </section>
                <section className="sheet-details">
                  <h3>Salvaguardas</h3>
                  <div className="save-grid">
                    {attrs.map((a) => (
                      <button disabled={!permitted(kind)} key={a} onClick={() => roll('save', a)}>
                        <small>{a}</small>
                        <b>{signed(mod(s.attributes[a]) + (s.saves[a] ? prof(s) : 0))}</b>
                      </button>
                    ))}
                  </div>
                  {[
                    ['Espécie', s.species],
                    ['Categoria de Nen', s.nen],
                    ['Classe Hunter', s.hunter],
                    ['Origem', s.origin],
                  ].map(([k, v]) => (
                    <div className="identity-field" key={k}>
                      <small>{k}</small>
                      <b>{v || 'Não definido'}</b>
                    </div>
                  ))}
                  {character.campaign_id && (isOwner || canEdit) && (
                    <p className="muted">
                      Ficha da campanha: o dono e o mestre podem editar. PV e condições do combate
                      ficam no token.
                    </p>
                  )}
                  {isOwner && canEdit && !drawer && (
                    <div className="stack share-sheet">
                      {character.campaign_id ? (
                        <small>
                          Esta é a cópia da campanha. Editar aqui não altera a sua ficha pessoal.
                        </small>
                      ) : (
                        <>
                          <h3>Exportar para campanha</h3>
                          {exportedTo.length > 0 && (
                            <small>
                              Já está em:{' '}
                              {campaigns
                                .filter((c) => exportedTo.includes(c.id))
                                .map((c) => c.name)
                                .join(', ')}
                            </small>
                          )}
                          <label>
                            Campanha
                            <select value={share} onChange={(e) => S(e.target.value)}>
                              <option value="">Selecione</option>
                              {campaigns
                                .filter((c) => !exportedTo.includes(c.id))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <button
                            disabled={busy || !share}
                            onClick={() => {
                              onShare(character, share);
                              S('');
                            }}
                          >
                            Exportar para campanha
                          </button>
                          <small>
                            A campanha recebe uma cópia, que você e o mestre podem editar. Esta
                            ficha pessoal continua salva.
                          </small>
                        </>
                      )}
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => onDelete(character)}
                      >
                        {character.campaign_id ? 'Remover da campanha' : 'Excluir ficha'}
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
            {tab === 'Técnicas' && (
              <section className="sheet-tab-content">
                <h3>Ataques e técnicas</h3>
                <button
                  disabled={
                    !permitted(kind) || (combatActive && !['action', 'reaction'].includes(kind))
                  }
                  onClick={() => roll('attack', '')}
                >
                  ⚄ Ataque padrão {signed(s.attackBonus)}
                </button>
                {s.techniques.map((t, i) => (
                  <button
                    className="skill-row"
                    disabled={!permitted(combatActive ? t.kind : kind)}
                    key={i}
                    onClick={() => roll('technique', String(i))}
                  >
                    <span>{t.name}</span>
                    <small>{t.kind}</small>
                    <b>{signed(t.bonus)}</b>
                    <span>⚄</span>
                  </button>
                ))}
                <p className="muted">
                  Cadastre técnicas e bônus no modo editar. Dano, aura e efeitos ainda são
                  arbitrados pelo mestre.
                </p>
              </section>
            )}
            {tab === 'Anotações' && (
              <section className="sheet-tab-content">
                <h3>Hatsu, inventário e anotações</h3>
                <p className="pre">{s.notes || 'Nenhuma anotação.'}</p>
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
