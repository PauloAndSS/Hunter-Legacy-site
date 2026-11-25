import React, { useState } from 'react';
import { Avatar, Meter, Modal } from './UI';
import Background, { entriesOf } from './Background';
import { applyAuto, grants, prepareEdit } from '../auto';
import { attrs, catalogs, skills, normalize, mod, prof, signed, skillBonus } from '../rules';

const KINDS = { action: 'Normal', power: 'Poder', bonus: 'Bônus', reaction: 'Reação' };
// Limites conferidos ao salvar, porque nem todas as abas ficam na tela.
const LIMITS = {
  level: ['Nível', 1, 30],
  pv: ['PV atual', 0, 9999],
  pvMax: ['PV máximo', 1, 9999],
  pve: ['Vitalidade atual', 0, 9999],
  pveMax: ['Vitalidade máxima', 1, 9999],
  pa: ['Aura atual', 0, 9999],
  paMax: ['Aura máxima', 0, 9999],
  cr: ['CR', 0, 100],
  speed: ['Deslocamento', 0, 96],
  attackBonus: ['Bônus de ataque', -100, 100],
};

function Num({ value, onChange, label, min = 0, max = 9999 }) {
  return (
    <input
      className="sheet-num"
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step="1"
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Math.trunc(+e.target.value))}
    />
  );
}

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
  const start = () => {
    const sheet = normalize(character.sheet);
    return { ...prepareEdit(sheet, entriesOf(sheet)), name: character.name || '' };
  };
  const [editing, E] = useState(isNew),
    [draft, D] = useState(start),
    [tab, T] = useState('Resumo'),
    [kind, K] = useState('action'),
    [share, S] = useState(''),
    [baseRevision, BR] = useState(character.revision),
    [err, ER] = useState('');
  // Na edição, `draft.base` é o que se digita e `s` já traz os benefícios automáticos somados.
  const s = editing ? applyAuto(draft, entriesOf(draft)) : normalize(character.sheet);
  const auto = grants(s, entriesOf(s));
  const set = (key, value) => D((old) => ({ ...old, [key]: value }));
  const setBase = (group, key, value) =>
    D((old) => ({
      ...old,
      base: { ...old.base, [group]: { ...old.base[group], [key]: value } },
    }));
  const choose = (key, value) =>
    D((old) =>
      key === 'origin'
        ? { ...old, origin: value, autoOrigin: !!value, originSkills: [] }
        : { ...old, hunter: value, autoHunter: !!value, hunterSkills: [] },
    );
  const setTechnique = (i, patch) =>
    set(
      'techniques',
      draft.techniques.map((v, j) => (j === i ? { ...v, ...patch } : v)),
    );
  const num = (key) => (
    <Num
      label={LIMITS[key][0]}
      min={LIMITS[key][1]}
      max={LIMITS[key][2]}
      value={draft[key]}
      onChange={(v) => set(key, v)}
    />
  );
  const permitted = (k) =>
    editing || (canRoll && !busy && (!combatActive || allowedKinds.includes(k)));
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
      if (!draft.name.trim()) throw Error('Informe o nome do personagem.');
      const check = (label, value, min, max) => {
        if (!Number.isInteger(value) || value < min || value > max)
          throw Error(`${label}: use um número de ${min} a ${max}.`);
      };
      for (const [k, [label, min, max]] of Object.entries(LIMITS)) check(label, draft[k], min, max);
      if (draft.level > 20) check('Proficiência épica', draft.proficiency ?? 6, 0, 20);
      for (const a of attrs) check(a, draft.base.attributes[a], 1, 30);
      for (const t of draft.techniques) {
        if (!t.name.trim()) throw Error('Dê um nome a cada técnica.');
        check(`Bônus de ${t.name}`, t.bonus, -100, 100);
      }
      for (const [k, label] of [
        ['pv', 'PV'],
        ['pve', 'Vitalidade'],
        ['pa', 'Aura'],
      ])
        if (draft[k] > draft[k + 'Max'])
          throw Error(`${label}: o valor atual não pode exceder o máximo.`);
      await onSave(applyAuto(draft, entriesOf(draft)), character, baseRevision);
      E(false);
    } catch (e) {
      ER(e.message);
    }
  }
  const meter = (key, label, color, value = s[key], max = s[key + 'Max']) =>
    editing ? (
      <div className="meter">
        <div>
          <span>{label}</span>
          <span className="meter-inputs">
            {num(key)} / {num(key + 'Max')}
          </span>
        </div>
        <div className="meter-track">
          <i
            style={{
              width: Math.min(100, (100 * (draft[key] || 0)) / (draft[key + 'Max'] || 1)) + '%',
              background: color || '#477e57',
            }}
          />
        </div>
      </div>
    ) : (
      <Meter label={label} value={value} max={max} color={color} />
    );
  const { origin, hunter } = entriesOf(s);
  const missing =
    (s.autoOrigin && origin ? origin.skillCount - (s.originSkills?.length || 0) : 0) +
    (s.autoHunter && hunter?.skillCount ? hunter.skillCount - (s.hunterSkills?.length || 0) : 0);
  const identity = (label, key, cat, entry) => (
    <div className="identity-field">
      <small>{label}</small>
      {editing ? (
        <select
          aria-label={label}
          value={draft[key]}
          onChange={(e) =>
            key === 'origin' || key === 'hunter'
              ? choose(key, e.target.value)
              : set(key, e.target.value)
          }
        >
          <option value="">Selecione</option>
          {(catalogs[cat] || []).map((v) => (
            <option key={v.id}>{v.name}</option>
          ))}
        </select>
      ) : (
        <b>{s[key] || 'Não definido'}</b>
      )}
      {entry && (
        <>
          <p>{entry.summary}</p>
          <button type="button" className="link" onClick={() => T('Origem e classe')}>
            Ver o que faz →
          </button>
        </>
      )}
    </div>
  );
  const Root = editing ? 'form' : 'div';
  return (
    <Modal
      title={isNew ? 'Criar ficha' : editing ? 'Editar ficha' : 'Ficha de personagem'}
      onClose={onClose}
      wide={!drawer}
      drawer={drawer}
    >
      <Root
        className={'sheet3' + (editing ? ' editing' : '')}
        {...(editing && { onSubmit: save, noValidate: true })}
      >
        <header className="sheet-hero">
          <Avatar profile={profile} fallback={s.name || character.name} size={96} />
          <div>
            <small>REGISTRO DA ASSOCIAÇÃO</small>
            {editing ? (
              <input
                className="hero-name"
                aria-label="Nome do personagem"
                maxLength={80}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Nome do personagem"
              />
            ) : (
              <h1>{character.name}</h1>
            )}
            <p>
              {s.hunter || 'Hunter'} · {s.nen || 'Nen não definido'}
            </p>
          </div>
          <div className="level-disc">
            <small>NÍVEL</small>
            {editing ? num('level') : <strong>{s.level}</strong>}
          </div>
        </header>
        <div className="sheet-actions row">
          <span className="muted">
            {editing
              ? 'Modo edição · Clique em perícias e salvaguardas para alternar'
              : 'Modo leitura · Clique em um valor para rolar'}
          </span>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                ER('');
                BR(character.revision);
                D(start());
                E(true);
              }}
            >
              ✎ Editar
            </button>
          )}
          {combatActive && !editing && (
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
        {combatActive && !editing && (
          <p className="sheet-hint">
            {allowedKinds.length
              ? `Ações disponíveis: ${allowedKinds.map((k) => ({ action: 'normal', power: 'poder', bonus: 'bônus', reaction: 'reação' })[k]).join(', ')}. Selecione o tipo correto.`
              : 'Aguarde seu turno ou uma reação autorizada pelo mestre.'}
          </p>
        )}
        {editing && missing > 0 && (
          <p className="sheet-hint">
            Faltam {missing} perícia(s) de origem ou classe para escolher.{' '}
            <button type="button" className="link" onClick={() => T('Origem e classe')}>
              Escolher →
            </button>
          </p>
        )}
        <div className="attribute-strip">
          {attrs.map((a) =>
            editing ? (
              <div className="attribute-tile" key={a}>
                <small>{a}</small>
                <strong>{signed(mod(s.attributes[a]))}</strong>
                <Num
                  label={a}
                  min={1}
                  max={30}
                  value={draft.base.attributes[a]}
                  onChange={(v) => setBase('attributes', a, v)}
                />
                {auto.attributes[a] && (
                  <em title={'Bônus de ' + auto.attributes[a].from}>
                    +{s.attributes[a] - draft.base.attributes[a]} origem = {s.attributes[a]}
                  </em>
                )}
              </div>
            ) : (
              <button
                type="button"
                key={a}
                disabled={!permitted(kind)}
                onClick={() => roll('attribute', a)}
              >
                <small>{a}</small>
                <strong>{signed(mod(s.attributes[a]))}</strong>
                <span>{s.attributes[a]}</span>
              </button>
            ),
          )}
        </div>
        <nav className="sheet-tabs" aria-label="Seções da ficha">
          {['Resumo', 'Origem e classe', 'Técnicas', 'Anotações'].map((t) => (
            <button
              type="button"
              key={t}
              className={tab === t ? 'active' : ''}
              onClick={() => T(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        {tab === 'Resumo' && (
          <div className="sheet-layout">
            <aside className="sheet-vitals">
              <Avatar profile={profile} fallback={s.name || character.name} size={150} />
              <div className="stat-diamond">
                <small>CR</small>
                {editing ? num('cr') : <strong>{s.cr}</strong>}
              </div>
              <div className="mini-stats">
                {editing ? (
                  <div>
                    <small>Iniciativa</small>
                    <b>{signed(mod(s.attributes.Agilidade))}</b>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!permitted(kind)}
                    onClick={() => roll('attribute', 'Agilidade')}
                  >
                    <small>Iniciativa</small>
                    <b>{signed(mod(s.attributes.Agilidade))}</b>
                  </button>
                )}
                <div>
                  <small>Proficiência</small>
                  {editing && draft.level > 20 ? (
                    <Num
                      label="Proficiência épica"
                      max={20}
                      value={draft.proficiency ?? 6}
                      onChange={(v) => set('proficiency', v)}
                    />
                  ) : (
                    <b>{signed(prof(s))}</b>
                  )}
                </div>
                <div>
                  <small>Deslocamento</small>
                  {editing ? (
                    <span className="meter-inputs">{num('speed')} casas</span>
                  ) : (
                    <b>{s.speed} casas</b>
                  )}
                </div>
              </div>
              {meter('pv', 'Pontos de vida', undefined, token?.hp ?? s.pv, token?.hpMax ?? s.pvMax)}
              {meter('pve', 'Vitalidade', '#b78748')}
              {meter('pa', 'Aura', '#8263aa')}
              {editing ? (
                <div className="attack-edit">⚄ Ataque {num('attackBonus')}</div>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={
                    !permitted(kind) || (combatActive && !['action', 'reaction'].includes(kind))
                  }
                  onClick={() => roll('attack', '')}
                >
                  ⚄ Ataque {signed(s.attackBonus)}
                </button>
              )}
            </aside>
            <section className="sheet-skills">
              <h3>Perícias</h3>
              {skills.map((k) => {
                const level = s.skillTraining[k.id] || 0;
                const source = auto.skills[k.id];
                return (
                  <button
                    type="button"
                    disabled={!permitted(kind)}
                    key={k.id}
                    onClick={() =>
                      editing
                        ? setBase('skillTraining', k.id, (level + 1) % 3)
                        : roll('skill', k.id)
                    }
                    title={
                      ['Sem proficiência', 'Proficiente', 'Maestria'][level] +
                      (source ? ` · ${source.from}` : '')
                    }
                    className="skill-row"
                  >
                    <span className={level ? 'trained' : ''}>{['○', '●', '◉'][level]}</span>
                    <small>{k.attribute}</small>
                    <span>
                      {k.name}
                      {source && <i className="auto-tag">auto</i>}
                    </span>
                    <b>{signed(skillBonus(s, k))}</b>
                    <span>{editing ? '⟳' : '⚄'}</span>
                  </button>
                );
              })}
            </section>
            <section className="sheet-details">
              <h3>Salvaguardas</h3>
              <div className="save-grid">
                {attrs.map((a) => (
                  <button
                    type="button"
                    disabled={!permitted(kind) || (editing && !!auto.saves[a])}
                    key={a}
                    aria-pressed={editing ? !!s.saves[a] : undefined}
                    title={auto.saves[a] ? 'Concedida por ' + auto.saves[a] : undefined}
                    onClick={() => (editing ? setBase('saves', a, !s.saves[a]) : roll('save', a))}
                  >
                    <small>
                      {s.saves[a] ? '● ' : '○ '}
                      {a}
                    </small>
                    <b>{signed(mod(s.attributes[a]) + (s.saves[a] ? prof(s) : 0))}</b>
                  </button>
                ))}
              </div>
              {identity('Espécie', 'species', 'especies')}
              {identity('Categoria de Nen', 'nen', 'categorias_nen')}
              {identity('Classe Hunter', 'hunter', 'classes_hunter', hunter)}
              {identity('Origem', 'origin', 'origens', origin)}
              {character.campaign_id && (isOwner || canEdit) && !editing && (
                <p className="muted">
                  Ficha da campanha: o dono e o mestre podem editar. PV e condições do combate ficam
                  no token.
                </p>
              )}
              {isOwner && canEdit && !drawer && !editing && (
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
                        type="button"
                        disabled={busy || !share}
                        onClick={() => {
                          onShare(character, share);
                          S('');
                        }}
                      >
                        Exportar para campanha
                      </button>
                      <small>
                        A campanha recebe uma cópia, que você e o mestre podem editar. Esta ficha
                        pessoal continua salva.
                      </small>
                    </>
                  )}
                  <button
                    type="button"
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
        {tab === 'Origem e classe' && (
          <Background sheet={s} editing={editing} set={set} choose={choose} />
        )}
        {tab === 'Técnicas' && (
          <section className="sheet-tab-content">
            <h3>Ataques e técnicas</h3>
            {!editing && (
              <button
                type="button"
                disabled={
                  !permitted(kind) || (combatActive && !['action', 'reaction'].includes(kind))
                }
                onClick={() => roll('attack', '')}
              >
                ⚄ Ataque padrão {signed(s.attackBonus)}
              </button>
            )}
            {s.techniques.map((t, i) =>
              editing ? (
                <div className="skill-row technique-row" key={i}>
                  <input
                    aria-label="Nome da técnica"
                    placeholder="Nome da técnica"
                    maxLength={80}
                    value={t.name}
                    onChange={(e) => setTechnique(i, { name: e.target.value })}
                  />
                  <select
                    aria-label="Tipo"
                    value={t.kind}
                    onChange={(e) => setTechnique(i, { kind: e.target.value })}
                  >
                    {Object.entries(KINDS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <Num
                    label="Bônus no d20"
                    min={-100}
                    max={100}
                    value={t.bonus}
                    onChange={(v) => setTechnique(i, { bonus: v })}
                  />
                  <button
                    type="button"
                    className="quiet"
                    aria-label={'Remover ' + (t.name || 'técnica')}
                    onClick={() =>
                      set(
                        'techniques',
                        draft.techniques.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="skill-row"
                  disabled={!permitted(combatActive ? t.kind : kind)}
                  key={i}
                  onClick={() => roll('technique', String(i))}
                >
                  <span>{t.name}</span>
                  <small>{KINDS[t.kind] || t.kind}</small>
                  <b>{signed(t.bonus)}</b>
                  <span>⚄</span>
                </button>
              ),
            )}
            {editing && (
              <button
                type="button"
                onClick={() =>
                  set('techniques', [...draft.techniques, { name: '', bonus: 0, kind: 'power' }])
                }
              >
                + Adicionar técnica
              </button>
            )}
            <p className="muted">
              {editing ? '' : 'Cadastre técnicas e bônus no modo editar. '}Dano, aura e efeitos
              ainda são arbitrados pelo mestre.
            </p>
          </section>
        )}
        {tab === 'Anotações' && (
          <section className="sheet-tab-content">
            <h3>Hatsu, inventário e anotações</h3>
            {editing ? (
              <textarea
                aria-label="Hatsu, inventário e anotações"
                rows="10"
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            ) : (
              <p className="pre">{s.notes || 'Nenhuma anotação.'}</p>
            )}
          </section>
        )}
        {editing && (
          <footer className="sheet-save">
            {err && (
              <p className="error" role="alert">
                {err}
              </p>
            )}
            <button className="primary" disabled={busy}>
              Salvar ficha
            </button>
            <button type="button" onClick={() => (isNew ? onClose() : E(false))}>
              Cancelar
            </button>
          </footer>
        )}
      </Root>
    </Modal>
  );
}
