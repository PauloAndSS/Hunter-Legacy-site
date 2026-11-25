import React from 'react';
import { catalogs, skills } from '../rules';
import { grants } from '../auto';

const find = (list, name) => list.find((e) => e.name === name);
export const entriesOf = (s) => ({
  species: find(catalogs.especies, s.species),
  nen: find(catalogs.categorias_nen, s.nen),
  origin: find(catalogs.origens, s.origin),
  hunter: find(catalogs.classes_hunter, s.hunter),
  traits: catalogs.tracos_quimera,
});
export const skillName = (id) => skills.find((k) => k.id === id)?.name || id;
const RANKS = ['single', 'double', 'triple'];
const LEVELS = { 1: 'proficiência', 2: 'maestria' };
export const grantText = (source) =>
  Object.entries(source?.skillGrants || {}).map(([id, l]) => `${skillName(id)} (${LEVELS[l]})`);

// Lista de marcação com limite. `options`: [{ id, label, title }].
export function Picker({ title, count, options, chosen = [], taken, onChange }) {
  const missing = count - chosen.length;
  return (
    <fieldset className="skill-picker">
      <legend>
        {title} <b>{missing > 0 ? `· faltam ${missing}` : '· completo'}</b>
      </legend>
      {options.map(({ id, label, title: hint }) => {
        const on = chosen.includes(id);
        return (
          <label key={id} className={on ? 'on' : ''} title={hint}>
            <input
              type="checkbox"
              checked={on}
              disabled={!on && missing <= 0}
              onChange={() => onChange(on ? chosen.filter((v) => v !== id) : [...chosen, id])}
            />
            {label}
            {taken?.has(id) && <small> (já concedida)</small>}
          </label>
        );
      })}
    </fieldset>
  );
}

export function Benefits({ auto, list }) {
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

export function Feature({ feature, rank, locked }) {
  const reached = RANKS.indexOf(rank);
  return (
    <article className={'feature' + (locked ? ' locked' : '')}>
      <h4>
        {feature.name}
        {feature.level && <span className="level-tag">nível {feature.level}</span>}
      </h4>
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

export function AutoToggle({ checked, onChange, children }) {
  return (
    <label className="inline auto-toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function EntrySelect({ label, value, list, onChange }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione</option>
      {list.map((v) => (
        <option key={v.id || v.name}>{v.name}</option>
      ))}
    </select>
  );
}

export const Source = ({ entry }) => (
  <small className="muted">
    {entry.source}, p. {entry.page}
  </small>
);

const skillOptions = (entry) => entry.skills.map((id) => ({ id, label: skillName(id) }));

// Origem e classe Hunter: descrição completa e, na edição, as escolhas.
export default function Background({ sheet, editing, set, choose }) {
  const entries = entriesOf(sheet);
  const { origin, hunter } = entries;
  const rank = sheet.hunterRank || 'amador';
  const license = catalogs.licencas_hunter.find((l) => l.id === rank);
  const isPro = rank !== 'amador';
  // Perícias que já vêm de outra fonte: o livro manda escolher uma diferente.
  const taken = (own) => new Set(Object.keys(grants(sheet, entries, own).skills));
  const chosenText = (entry, chosen) =>
    entry.skillCount
      ? [
          chosen?.length
            ? `Perícias: ${chosen.map(skillName).join(', ')}`
            : `${entry.skillCount} perícias à escolha`,
        ]
      : [];
  return (
    <div className="background-tab">
      <section>
        <small>ORIGEM</small>
        {editing ? (
          <EntrySelect
            label="Origem (aba)"
            value={sheet.origin}
            list={catalogs.origens}
            onChange={(v) => choose('origin', v)}
          />
        ) : (
          <h3>{sheet.origin || 'Não definida'}</h3>
        )}
        {origin && (
          <>
            <p>{origin.summary}</p>
            <Benefits
              auto={sheet.autoOrigin}
              list={[
                `${origin.attribute} +${origin.attributeBonus} (até 20)`,
                `Salvaguarda de ${origin.save}`,
                ...chosenText(origin, sheet.originSkills),
              ]}
            />
            {editing && (
              <>
                <AutoToggle checked={sheet.autoOrigin} onChange={(v) => set('autoOrigin', v)}>
                  Aplicar atributo, salvaguarda e perícias
                </AutoToggle>
                {sheet.autoOrigin && (
                  <Picker
                    title={`Escolha ${origin.skillCount} perícias`}
                    count={origin.skillCount}
                    options={skillOptions(origin)}
                    chosen={sheet.originSkills}
                    taken={taken('origin')}
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
            <Source entry={origin} />
          </>
        )}
      </section>
      <section>
        <small>CLASSE HUNTER</small>
        {editing ? (
          <EntrySelect
            label="Classe Hunter (aba)"
            value={sheet.hunter}
            list={catalogs.classes_hunter}
            onChange={(v) => choose('hunter', v)}
          />
        ) : (
          <h3>{sheet.hunter || 'Não definida'}</h3>
        )}
        {hunter && (
          <>
            <p>{hunter.summary}</p>
            {editing && (
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
            )}
            <p className="license">
              <b>{license?.name}.</b>{' '}
              {hunter.noLicenseBenefits
                ? 'Sem classe, a licença libera apenas o acesso a informações.'
                : license?.summary}
            </p>
            <Benefits
              auto={sheet.autoHunter}
              list={[...grantText(hunter), ...chosenText(hunter, sheet.hunterSkills)]}
            />
            {editing && (
              <>
                <AutoToggle checked={sheet.autoHunter} onChange={(v) => set('autoHunter', v)}>
                  Aplicar perícias da classe
                </AutoToggle>
                {sheet.autoHunter && hunter.skillCount && (
                  <Picker
                    title={`Escolha ${hunter.skillCount} perícias`}
                    count={hunter.skillCount}
                    options={skillOptions(hunter)}
                    chosen={sheet.hunterSkills}
                    taken={taken('hunter')}
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
            <Source entry={hunter} />
          </>
        )}
      </section>
    </div>
  );
}
