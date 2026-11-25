// Benefícios automáticos de espécie, categoria de Nen, origem e classe Hunter.
// `base` guarda o que o jogador definiu; os campos da ficha guardam o total usado nas rolagens
// do servidor. Trocar uma escolha recalcula a partir da base, sem acumular bônus.
import { mod, prof } from './math.js';

// Campos que podem ser calculados. `sheet.manual[campo]` mantém o valor digitado.
export const FIELDS = ['pvMax', 'pveMax', 'paMax', 'cr', 'speed', 'attackBonus'];
const METERS_PER_SQUARE = 1.5;

const copy = (s) => ({
  attributes: { ...s.attributes },
  skillTraining: { ...s.skillTraining },
  saves: { ...s.saves },
  ...Object.fromEntries(FIELDS.map((k) => [k, s[k]])),
});
// Fichas da v0.7 têm base sem os campos calculados: valem os da própria ficha.
const baseOf = (s) => copy({ ...copy(s), ...s.base });
const picks = (entry, chosen = []) =>
  chosen.filter((id) => entry.skills?.includes(id)).slice(0, entry.skillCount || 0);

export const variantOf = (sheet, species) =>
  species?.variants?.find((v) => v.name === sheet.speciesVariant);
export const pathOf = (sheet, nen) => nen?.paths?.find((p) => p.name === sheet.nenPath);
export const traitsOf = (sheet, traits = []) =>
  traits.filter((t) => sheet.speciesTraits?.includes(t.id));
export function mainAttribute(sheet, nen) {
  if (!nen) return '';
  return sheet.nenMain || pathOf(sheet, nen)?.mains?.[0] || nen.main;
}
export function chosenSaves(sheet, nen) {
  const c = nen?.saveChoice;
  if (!c) return [];
  return (sheet.nenSaves || []).filter((a) => c.options.includes(a)).slice(0, c.count);
}

// Lista o que cada fonte concede, com o nome da fonte. `skip` ignora uma delas.
export function grants(sheet, { species, nen, origin, hunter }, skip) {
  const g = { attributes: {}, skills: {}, saves: {} };
  const attribute = (a, bonus, from) => {
    if (!a) return;
    const old = g.attributes[a];
    g.attributes[a] = {
      bonus: (old?.bonus || 0) + bonus,
      from: old && old.from !== from ? `${old.from} e ${from}` : from,
    };
  };
  const skill = (id, level, from) => {
    if (level > (g.skills[id]?.level || 0)) g.skills[id] = { level, from };
  };
  const all = (source, from) => {
    for (const [id, level] of Object.entries(source?.skillGrants || {})) skill(id, level, from);
    for (const a of source?.saves || []) g.saves[a] = from;
  };
  if (species && sheet.autoSpecies && skip !== 'species') {
    // Dois pontos: em atributos diferentes (+1 e +1) ou no mesmo (+2).
    for (const a of (sheet.speciesAttrs || []).slice(0, 2)) attribute(a, 1, species.name);
    all(variantOf(sheet, species), species.name);
  }
  if (nen && sheet.autoNen && skip !== 'nen') {
    for (const a of [...(nen.saves || []), ...chosenSaves(sheet, nen)]) g.saves[a] = nen.name;
    const path = pathOf(sheet, nen);
    if (path && sheet.level >= (path.grantLevel || 1)) all(path, path.name);
  }
  if (origin && sheet.autoOrigin && skip !== 'origin') {
    attribute(origin.attribute, origin.attributeBonus || 0, origin.name);
    if (origin.save) g.saves[origin.save] = origin.name;
    for (const id of picks(origin, sheet.originSkills)) skill(id, 1, origin.name);
  }
  if (hunter && sheet.autoHunter && skip !== 'hunter') {
    all(hunter, hunter.name);
    for (const id of picks(hunter, sheet.hunterSkills)) skill(id, 1, hunter.name);
  }
  return g;
}

// Pelo livro, esses bônus não elevam o atributo acima de 20.
const raised = (value, bonus = 0) => Math.max(value, Math.min(20, value + bonus));

// Valores calculados pelas regras, a partir dos atributos já somados.
function formulas(s, { species, nen, traits }) {
  const out = {};
  const con = mod(s.attributes['Constituição']);
  const level = Math.max(1, Number(s.level) || 1);
  const own = species?.hasTraits ? traitsOf(s, traits) : [];
  if (species && s.autoSpecies) {
    out.pveMax = Math.max(1, species.basePve + con);
    out.speed = Math.floor(
      Math.max(species.speed, ...own.map((t) => t.speed || 0)) / METERS_PER_SQUARE,
    );
  }
  if (nen && s.autoNen) {
    const extra = s.autoSpecies ? own.reduce((n, t) => n + (t.pvBonus || 0), 0) : 0;
    const vital = (species?.basePve || 0) + con;
    const path = pathOf(s, nen);
    const average = path?.maxHitDieLevel <= level ? nen.hitDie : nen.average;
    // 1º nível: dado máximo; depois, média por nível até o 20º; épicos ímpares dão +10.
    const pv = nen.hitDie
      ? nen.hitDie +
        vital +
        (Math.min(20, level) - 1) * (average + con) +
        10 * Math.max(0, Math.ceil((level - 20) / 2))
      : vital;
    out.pvMax = Math.max(1, pv + extra);
    out.paMax = 20 * level;
    const main = mod(s.attributes[mainAttribute(s, nen)]);
    out.cr = Math.min(30, 10 + main + Math.min(con, Math.floor(level / 2)));
    out.attackBonus = main + prof({ ...s, level });
  }
  return out;
}

// Só os campos que estão no automático.
export function derived(sheet, entries) {
  return Object.fromEntries(
    Object.entries(formulas(sheet, entries)).filter(([k]) => !sheet.manual?.[k]),
  );
}

export function applyAuto(sheet, entries) {
  const base = baseOf(sheet);
  const g = grants(sheet, entries);
  const next = { ...sheet, base, ...copy(base) };
  for (const [a, { bonus }] of Object.entries(g.attributes))
    next.attributes[a] = raised(Number(base.attributes[a] ?? 10), bonus);
  for (const [id, { level }] of Object.entries(g.skills))
    next.skillTraining[id] = Math.max(Number(base.skillTraining[id]) || 0, level);
  for (const a of Object.keys(g.saves)) next.saves[a] = true;
  return Object.assign(next, derived(next, entries));
}

// Prepara a ficha para edição. Fichas antigas não têm base: seus valores são mantidos e os
// benefícios só entram se o jogador ligar a opção, para não somar duas vezes.
// Se os totais foram alterados por uma versão antiga do site, eles prevalecem sobre a base.
export function prepareEdit(sheet, entries) {
  const s = {
    ...sheet,
    autoSpecies: !!sheet.autoSpecies,
    autoNen: !!sheet.autoNen,
    autoOrigin: !!sheet.autoOrigin,
    autoHunter: !!sheet.autoHunter,
    speciesAttrs: sheet.speciesAttrs || ['', ''],
    speciesTraits: sheet.speciesTraits || [],
    nenSaves: sheet.nenSaves || [],
    originSkills: sheet.originSkills || [],
    hunterSkills: sheet.hunterSkills || [],
    manual: { ...sheet.manual },
  };
  if (!s.base) return { ...s, base: copy(s) };
  const base = baseOf(s);
  const g = grants(s, entries);
  const total = applyAuto(s, entries);
  for (const a of Object.keys(s.attributes))
    if (s.attributes[a] !== total.attributes[a])
      base.attributes[a] =
        s.attributes[a] > 20 ? s.attributes[a] : s.attributes[a] - (g.attributes[a]?.bonus || 0);
  for (const id of new Set([...Object.keys(s.skillTraining), ...Object.keys(base.skillTraining)]))
    if ((s.skillTraining[id] || 0) !== (total.skillTraining[id] || 0))
      base.skillTraining[id] = s.skillTraining[id] || 0;
  for (const a of new Set([...Object.keys(s.saves), ...Object.keys(base.saves)]))
    if (!!s.saves[a] !== !!total.saves[a]) base.saves[a] = !!s.saves[a];
  // Confere os campos depois dos atributos, pois dependem deles.
  const expected = derived({ ...s }, entries);
  for (const k of FIELDS) {
    if (!(k in expected)) base[k] = s[k];
    else if (s[k] !== expected[k]) {
      base[k] = s[k];
      s.manual[k] = true;
    }
  }
  return { ...s, base };
}
