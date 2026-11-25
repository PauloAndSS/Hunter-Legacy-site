export const catalogs = Object.fromEntries(
  Object.entries(import.meta.glob('./data/*.json', { eager: true, import: 'default' })).map(
    ([k, v]) => [k.split('/').pop().replace('.json', ''), v.entries || []],
  ),
);
export const attrs = ['Força', 'Agilidade', 'Constituição', 'Sabedoria', 'Espírito', 'Presença'];
export const attrCodes = {
  FOR: 'Força',
  AGI: 'Agilidade',
  CON: 'Constituição',
  SAB: 'Sabedoria',
  ESP: 'Espírito',
  PRE: 'Presença',
};
export const skills = catalogs.pericias || [];
export const conditions = {
  SG: 'Sangramento',
  QM: 'Queimadura',
  EV: 'Envenenado',
  AT: 'Atordoado',
  PL: 'Paralisado',
  SO: 'Sonolento',
  SF: 'Sufocado',
  SU: 'Surdo',
  EX: 'Exaustão',
  CE: 'Cego',
};
export const initial = {
  level: 1,
  pv: 10,
  pvMax: 10,
  pve: 10,
  pveMax: 10,
  pa: 0,
  paMax: 0,
  cr: 10,
  speed: 6,
  attackBonus: 0,
  attributes: Object.fromEntries(attrs.map((x) => [x, 10])),
  species: '',
  nen: '',
  hunter: '',
  origin: '',
  notes: '',
  skillTraining: {},
  saves: {},
  techniques: [],
};
export const normalize = (s) => ({
  ...initial,
  ...s,
  pvMax: s?.pvMax ?? Math.max(1, s?.pv ?? 10),
  pveMax: s?.pveMax ?? Math.max(1, s?.pve ?? 10),
  paMax: s?.paMax ?? Math.max(0, s?.pa ?? 0),
  attributes: { ...initial.attributes, ...s?.attributes },
  skillTraining: s?.skillTraining || {},
  saves: s?.saves || {},
  techniques: s?.techniques || [],
});
export const mod = (n) => Math.floor((Number(n ?? 10) - 10) / 2);
export const prof = (s) =>
  s.level <= 20 ? 2 + Math.floor((Math.max(1, s.level) - 1) / 4) : Number(s.proficiency || 6);
export const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
export const skillBonus = (s, k) =>
  mod(s.attributes[attrCodes[k.attribute]]) + prof(s) * (Number(s.skillTraining[k.id]) || 0);
export const kinds = {
  npc: 'NPC',
  artifact: 'Artefato',
  location: 'Localização',
  quest: 'Missão',
  map: 'Mapa',
  beast: 'Criatura',
  note: 'Nota privada',
};
