import React from 'react';
import { catalogs, skills } from '../rules';
import { grants } from '../auto';

export const entriesOf = (s) => ({
  origin: catalogs.origens.find((e) => e.name === s.origin),
  hunter: catalogs.classes_hunter.find((e) => e.name === s.hunter),
});
const skillName = (id) => skills.find((k) => k.id === id)?.name || id;
const RANKS = ['single', 'double', 'triple'];
const LEVELS = { 1: 'proficiência', 2: 'maestria' };

function Picker({ entry, chosen = [], taken, onChange }) {
  const missing = entry.skillCount - chosen.length;
  return (
    <fieldset className="skill-picker">
      <legend>
        Escolha {entry.skillCount} perícias{' '}
        <b>{missing > 0 ? `· faltam ${missing}` : '· completo'}</b>
      </legend>
      {entry.skills.map((id) => {
        const on = chosen.includes(id);
        return (
          <label key={id} className={on ? 'on' : ''}>
            <input
              type="checkbox"
              checked={on}
              disabled={!on && missing <= 0}
              onChange={() => onChange(on ? chosen.filter((v) => v !== id) : [...chosen, id])}
            />
            {skillName(id)}
            {taken.has(id) && <small> (já concedida)</small>}
          </label>
        );
      })}
    </fieldset>
  );
}

function Benefits({ entry, sheet, kind }) {
  const auto = kind === 'origin' ? sheet.autoOrigin : sheet.autoHunter;
  const chosen = kind === 'origin' ? sheet.originSkills : sheet.hunterSkills;
  const list = [];
  if (entry.attribute) list.push(`${entry.attribute} +${entry.attributeBonus} (até 20)`);
  if (entry.save) list.push(`Salvaguarda de ${entry.save}`);
  for (const [id, level] of Object.entries(entry.skillGrants || {}))
    list.push(`${skillName(id)} (${LEVELS[level]})`);
  if (entry.skillCount)
    list.push(
      chosen?.length
        ? `Perícias: ${chosen.map(skillName).join(', ')}`
        : `${entry.skillCount} perícias à escolha`,
    );
  if (!list.length) return null;
  return (
    <div className="benefits">
      <small>{auto ? '✓ Aplicado automaticamente' : 'Não aplicado automaticamente'}</small>
      <ul>
        {list.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Feature({ feature, rank, locked }) {
  const reached = RANKS.indexOf(rank);
  return (
    <article className={'feature' + (locked ? ' locked' : '')}>
      <h4>{feature.name}</h4>
      <p>{feature.text}</p>
      {feature.evolution && (
        <ul>
          {RANKS.map((r, i) => (
            <li key={r} className={i === reached ? 'current' : ''}>
              <b>{'★'.repeat(i + 1)}</b> {feature.evolution[r]}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

// Origem e classe Hunter: descrição completa e, na edição, as escolhas.
export default function Background({ sheet, editing, set, choose }) {
  const { origin, hunter } = entriesOf(sheet);
  const rank = sheet.hunterRank || 'amador';
  const license = catalogs.licencas_hunter.find((l) => l.id === rank);
  const isPro = rank !== 'amador';
  // Perícias que vêm da outra fonte: o livro manda escolher uma diferente.
  const from = (o, h) =>
    new Set(
      Object.keys(
        grants(
          { ...sheet, autoOrigin: o && sheet.autoOrigin, autoHunter: h && sheet.autoHunter },
          { origin, hunter },
        ).skills,
      ),
    );
  const select = (key, list) => (
    <select value={sheet[key]} onChange={(e) => choose(key, e.target.value)} aria-label={key}>
      <option value="">Selecione</option>
      {list.map((v) => (
        <option key={v.id}>{v.name}</option>
      ))}
    </select>
  );
  const auto = (key, text) => (
    <label className="inline auto-toggle">
      <input type="checkbox" checked={!!sheet[key]} onChange={(e) => set(key, e.target.checked)} />
      {text}
    </label>
  );
  return (
    <div className="background-tab">
      <section>
        <small>ORIGEM</small>
        {editing ? select('origin', catalogs.origens) : <h3>{sheet.origin || 'Não definida'}</h3>}
        {origin && (
          <>
            <p>{origin.summary}</p>
            <Benefits entry={origin} sheet={sheet} kind="origin" />
            {editing && (
              <>
                {auto('autoOrigin', 'Aplicar atributo, salvaguarda e perícias')}
                {sheet.autoOrigin && (
                  <Picker
                    entry={origin}
                    chosen={sheet.originSkills}
                    taken={from(false, true)}
                    onChange={(v) => set('originSkills', v)}
                  />
                )}
              </>
            )}
            <p className="equipment">
              <b>Equipamento inicial:</b> {origin.equipment}.
            </p>
            {origin.features.map((f) => (
              <Feature key={f.name} feature={f} />
            ))}
            <small className="muted">
              {origin.source}, p. {origin.page}
            </small>
          </>
        )}
      </section>
      <section>
        <small>CLASSE HUNTER</small>
        {editing ? (
          select('hunter', catalogs.classes_hunter)
        ) : (
          <h3>{sheet.hunter || 'Não definida'}</h3>
        )}
        {hunter && (
          <>
            <p>{hunter.summary}</p>
            {editing ? (
              <label>
                Licença
                <select value={rank} onChange={(e) => set('hunterRank', e.target.value)}>
                  {catalogs.licencas_hunter.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="license">
              <b>{license?.name}.</b>{' '}
              {hunter.noLicenseBenefits
                ? 'Sem classe, a licença libera apenas o acesso a informações.'
                : license?.summary}
            </p>
            <Benefits entry={hunter} sheet={sheet} kind="hunter" />
            {editing && (
              <>
                {auto('autoHunter', 'Aplicar perícias da classe')}
                {sheet.autoHunter && hunter.skillCount && (
                  <Picker
                    entry={hunter}
                    chosen={sheet.hunterSkills}
                    taken={from(true, false)}
                    onChange={(v) => set('hunterSkills', v)}
                  />
                )}
              </>
            )}
            {hunter.equipment && (
              <p className="equipment">
                <b>Ferramentas:</b> {hunter.equipment}.
              </p>
            )}
            {!isPro && !hunter.noLicenseBenefits && (
              <p className="sheet-hint">
                Talentos e Conhecimento do Ofício valem a partir de Pro Hunter.
              </p>
            )}
            {hunter.talents.map((name) => (
              <Feature
                key={name}
                locked={!isPro}
                feature={{
                  name: 'Talento: ' + name,
                  text: catalogs.talentos.find((t) => t.name === name)?.summary,
                }}
              />
            ))}
            {hunter.features.map((f) => (
              <Feature
                key={f.name}
                feature={f}
                rank={rank}
                locked={!isPro && !hunter.noLicenseBenefits}
              />
            ))}
            <small className="muted">
              {hunter.source}, p. {hunter.page}
            </small>
          </>
        )}
      </section>
    </div>
  );
}
