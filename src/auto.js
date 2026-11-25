// Benefícios automáticos de origem e classe Hunter.
// `base` guarda o que o jogador definiu; os campos da ficha guardam o total usado nas rolagens
// do servidor. Trocar de origem ou classe recalcula a partir da base, sem acumular bônus.
const copy = (s) => ({
  attributes: { ...s.attributes },
  skillTraining: { ...s.skillTraining },
  saves: { ...s.saves },
});
const picks = (entry, chosen = []) =>
  chosen.filter((id) => entry.skills?.includes(id)).slice(0, entry.skillCount || 0);

// Lista o que cada fonte concede, com o nome da fonte para exibição.
export function grants(sheet, { origin, hunter }) {
  const g = { attributes: {}, skills: {}, saves: {} };
  const skill = (id, level, from) => {
    if (level > (g.skills[id]?.level || 0)) g.skills[id] = { level, from };
  };
  if (origin && sheet.autoOrigin) {
    if (origin.attribute)
      g.attributes[origin.attribute] = { bonus: origin.attributeBonus || 0, from: origin.name };
    if (origin.save) g.saves[origin.save] = origin.name;
    for (const id of picks(origin, sheet.originSkills)) skill(id, 1, origin.name);
  }
  if (hunter && sheet.autoHunter) {
    for (const [id, level] of Object.entries(hunter.skillGrants || {}))
      skill(id, level, hunter.name);
    for (const id of picks(hunter, sheet.hunterSkills)) skill(id, 1, hunter.name);
  }
  return g;
}

// Pelo livro, o bônus da origem não eleva o atributo acima de 20.
const raised = (value, bonus = 0) => Math.max(value, Math.min(20, value + bonus));

export function applyAuto(sheet, entries) {
  const base = sheet.base || copy(sheet);
  const g = grants(sheet, entries);
  const next = { ...sheet, base, ...copy(base) };
  for (const [a, { bonus }] of Object.entries(g.attributes))
    next.attributes[a] = raised(Number(base.attributes[a] ?? 10), bonus);
  for (const [id, { level }] of Object.entries(g.skills))
    next.skillTraining[id] = Math.max(Number(base.skillTraining[id]) || 0, level);
  for (const a of Object.keys(g.saves)) next.saves[a] = true;
  return next;
}

// Prepara a ficha para edição. Fichas antigas não têm base: seus valores são mantidos e os
// benefícios só entram se o jogador ligar a opção, para não somar duas vezes.
// Se os totais foram alterados por uma versão antiga do site, eles prevalecem sobre a base.
export function prepareEdit(sheet, entries) {
  const s = {
    ...sheet,
    autoOrigin: !!sheet.autoOrigin,
    autoHunter: !!sheet.autoHunter,
    originSkills: sheet.originSkills || [],
    hunterSkills: sheet.hunterSkills || [],
  };
  if (!s.base) return { ...s, base: copy(s) };
  const base = {
    attributes: { ...s.base.attributes },
    skillTraining: { ...s.base.skillTraining },
    saves: { ...s.base.saves },
  };
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
  return { ...s, base };
}
