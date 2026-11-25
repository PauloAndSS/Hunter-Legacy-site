import React from 'react';
import { attrs, catalogs } from '../rules';
import { chosenSaves, mainAttribute, pathOf, traitsOf, variantOf } from '../auto';
import {
  AutoToggle,
  Benefits,
  EntrySelect,
  Feature,
  Picker,
  Source,
  entriesOf,
  grantText,
} from './Background';

const MAINS = ['Força', 'Agilidade', 'Sabedoria', 'Presença'];
const TYPES = { comum: ['common', 'comuns'], especifico: ['specific', 'específicos'] };
const meters = (n) => String(n).replace('.', ',') + ' m';

function attributeText(chosen = []) {
  const [a, b] = chosen;
  if (!a && !b) return '+2 em um atributo ou +1 em dois (até 20)';
  if (a === b) return `${a} +2 (até 20)`;
  return [a, b]
    .filter(Boolean)
    .map((v) => `${v} +1`)
    .join(' e ');
}

// O que ainda falta escolher, para o aviso da edição.
export function missingLineage(sheet) {
  const { species, nen, traits } = entriesOf(sheet);
  let n = 0;
  if (species && sheet.autoSpecies) {
    n += 2 - (sheet.speciesAttrs || []).filter(Boolean).length;
    const variant = variantOf(sheet, species);
    if (!variant) n += 1;
    else if (species.hasTraits)
      n += Math.max(0, variant.common + variant.specific - traitsOf(sheet, traits).length);
  }
  if (nen?.saveChoice && sheet.autoNen) n += nen.saveChoice.count - chosenSaves(sheet, nen).length;
  return n;
}

// Espécie e categoria de Nen: descrição completa e, na edição, as escolhas.
export default function Lineage({ sheet, editing, set, choose }) {
  const { species, nen, traits } = entriesOf(sheet);
  const level = Number(sheet.level) || 1;
  const variant = variantOf(sheet, species);
  const path = pathOf(sheet, nen);
  const own = species?.hasTraits ? traitsOf(sheet, traits) : [];
  const locked = (f) => !!f.level && level < f.level;
  const setAttr = (i, v) => {
    const next = [...(sheet.speciesAttrs || ['', ''])];
    next[i] = v;
    set('speciesAttrs', next);
  };
  const setTraits = (type, ids) =>
    set('speciesTraits', [...own.filter((t) => t.type !== type).map((t) => t.id), ...ids]);
  return (
    <div className="background-tab">
      <section>
        <small>ESPÉCIE</small>
        {editing ? (
          <EntrySelect
            label="Espécie (aba)"
            value={sheet.species}
            list={catalogs.especies}
            onChange={(v) => choose('species', v)}
          />
        ) : (
          <h3>{sheet.species || 'Não definida'}</h3>
        )}
        {species && (
          <>
            <p>{species.summary}</p>
            <Benefits
              auto={sheet.autoSpecies}
              list={[
                attributeText(sheet.speciesAttrs),
                `Vitalidade: ${species.basePve} + Constituição`,
                `Deslocamento de ${meters(species.speed)} (${species.speed / 1.5} casas)`,
                ...grantText(variant),
                ...(variant?.saves || []).map((a) => `Salvaguarda de ${a}`),
                ...own.filter((t) => t.speed).map((t) => `${t.name}: ${meters(t.speed)}`),
                ...own
                  .filter((t) => t.pvBonus && sheet.autoNen)
                  .map((t) => `${t.name}: +${t.pvBonus} PV`),
              ]}
            />
            {editing && (
              <>
                <AutoToggle checked={sheet.autoSpecies} onChange={(v) => set('autoSpecies', v)}>
                  Aplicar atributos, vitalidade, deslocamento e variante
                </AutoToggle>
                {sheet.autoSpecies && (
                  <div className="pair">
                    {[0, 1].map((i) => (
                      <label key={i}>
                        +1 em
                        <select
                          value={sheet.speciesAttrs?.[i] || ''}
                          onChange={(e) => setAttr(i, e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {attrs.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <small>Repita o atributo para receber +2.</small>
                  </div>
                )}
                <label>
                  Variante
                  <select
                    value={sheet.speciesVariant || ''}
                    onChange={(e) => set({ speciesVariant: e.target.value, speciesTraits: [] })}
                  >
                    <option value="">Selecione</option>
                    {species.variants.map((v) => (
                      <option key={v.name}>{v.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <p className="equipment">
              <b>Nado:</b> {meters(species.swim)}. <b>Tamanho:</b> {species.size}.
            </p>
            {variant && (
              <Feature
                feature={{
                  name: 'Variante: ' + variant.name,
                  text: `${variant.summary} ${variant.text}`,
                }}
              />
            )}
            {editing &&
              species.hasTraits &&
              variant &&
              Object.entries(TYPES).map(([type, [key, label]]) => (
                <Picker
                  key={type}
                  title={`Traços ${label}: escolha ${variant[key]}`}
                  count={variant[key]}
                  options={traits
                    .filter((t) => t.type === type)
                    .map((t) => ({ id: t.id, label: t.name, title: `${t.group}: ${t.summary}` }))}
                  chosen={own.filter((t) => t.type === type).map((t) => t.id)}
                  onChange={(ids) => setTraits(type, ids)}
                />
              ))}
            {own.map((t) => (
              <Feature key={t.id} feature={{ name: 'Traço: ' + t.name, text: t.summary }} />
            ))}
            {species.features.map((f) => (
              <Feature key={f.name} feature={f} locked={locked(f)} />
            ))}
            <Source entry={species} />
          </>
        )}
      </section>
      <section>
        <small>CATEGORIA DE NEN</small>
        {editing ? (
          <EntrySelect
            label="Categoria de Nen (aba)"
            value={sheet.nen}
            list={catalogs.categorias_nen}
            onChange={(v) => choose('nen', v)}
          />
        ) : (
          <h3>{sheet.nen || 'Não definida'}</h3>
        )}
        {nen && (
          <>
            <p>{nen.summary}</p>
            <Benefits
              auto={sheet.autoNen}
              list={[
                `Atributo principal: ${mainAttribute(sheet, nen)}`,
                ...[...nen.saves, ...chosenSaves(sheet, nen)].map((a) => `Salvaguarda de ${a}`),
                nen.hitDie
                  ? `PV: d${nen.hitDie} no 1º nível e média ${nen.average} por nível, mais Constituição e vida base da espécie`
                  : 'PV: vida base da espécie + Constituição',
                'Aura: 20 × nível',
                'CR sem armadura: 10 + principal + Constituição (até metade do nível), máximo 30',
                'Ataque: principal + proficiência',
                ...(path && level >= (path.grantLevel || 1)
                  ? [...grantText(path), ...(path.saves || []).map((a) => `Salvaguarda de ${a}`)]
                  : []),
              ]}
            />
            {editing && (
              <>
                <AutoToggle checked={sheet.autoNen} onChange={(v) => set('autoNen', v)}>
                  Aplicar salvaguardas, PV, aura, CR e ataque
                </AutoToggle>
                {sheet.autoNen && (
                  <small>
                    Rolou os dados de vida ou usa armadura? No Resumo, clique em “auto” ao lado do
                    valor para digitá-lo.
                  </small>
                )}
                {nen.saveChoice && (
                  <Picker
                    title={`Salvaguardas: escolha ${nen.saveChoice.count}`}
                    count={nen.saveChoice.count}
                    options={nen.saveChoice.options.map((a) => ({ id: a, label: a }))}
                    chosen={chosenSaves(sheet, nen)}
                    onChange={(v) => set('nenSaves', v)}
                  />
                )}
                {nen.paths.length > 0 && (
                  <label>
                    Caminho (2º nível)
                    <select
                      value={sheet.nenPath || ''}
                      onChange={(e) => set({ nenPath: e.target.value, nenMain: '' })}
                    >
                      <option value="">Selecione</option>
                      {nen.paths.map((v) => (
                        <option key={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Atributo principal
                  <select
                    value={mainAttribute(sheet, nen)}
                    onChange={(e) => set('nenMain', e.target.value)}
                  >
                    {MAINS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <small>Mude só se o caminho ou uma Habilidade Básica permitir.</small>
                </label>
              </>
            )}
            {path && (
              <article className="feature path">
                <h4>Caminho: {path.name}</h4>
                <p>{path.summary}</p>
              </article>
            )}
            {path?.features.map((f) => (
              <Feature key={path.name + f.name} feature={f} locked={locked(f)} />
            ))}
            {nen.features.map((f) => (
              <Feature key={f.name} feature={f} locked={locked(f)} />
            ))}
            <Source entry={nen} />
          </>
        )}
      </section>
    </div>
  );
}
