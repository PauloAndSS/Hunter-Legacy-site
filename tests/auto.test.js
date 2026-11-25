import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyAuto, grants, prepareEdit } from '../src/auto.js';

const load = (f) =>
  JSON.parse(fs.readFileSync(new URL(`../src/data/${f}.json`, import.meta.url))).entries;
const origins = load('origens');
const classes = load('classes_hunter');
const skills = load('pericias').map((s) => s.id);
const species = load('especies');
const categories = load('categorias_nen');
const traits = load('tracos_quimera');
const talents = load('talentos').map((t) => t.name);
const attrs = ['Força', 'Agilidade', 'Constituição', 'Sabedoria', 'Espírito', 'Presença'];
const find = (list, name) => list.find((e) => e.name === name);
const sheet = (extra) => ({
  attributes: Object.fromEntries(attrs.map((a) => [a, 10])),
  skillTraining: {},
  saves: {},
  ...extra,
});

test('catalog entries are complete and reference known ids', () => {
  assert.equal(origins.length, 23);
  assert.equal(classes.length, 14);
  for (const o of origins) {
    assert.ok(attrs.includes(o.attribute) && attrs.includes(o.save), o.name);
    assert.ok(o.summary && o.equipment && o.features[0].text, o.name);
    assert.equal(new Set(o.skills).size, o.skills.length, o.name);
    assert.ok(o.skills.length >= o.skillCount, o.name);
    for (const id of o.skills) assert.ok(skills.includes(id), o.name + ' ' + id);
  }
  for (const c of classes) {
    assert.ok(c.summary && c.features.length, c.name);
    for (const id of Object.keys(c.skillGrants)) assert.ok(skills.includes(id), c.name);
    for (const t of c.talents) assert.ok(talents.includes(t), c.name + ' ' + t);
  }
});

test('origin applies attribute, save and only its allowed skills', () => {
  const origin = find(origins, 'Monge');
  const s = applyAuto(
    sheet({ autoOrigin: true, originSkills: ['atletismo', 'medicina', 'historia'] }),
    { origin },
  );
  assert.equal(s.attributes['Força'], 12);
  assert.equal(s.saves.Sabedoria, true);
  assert.deepEqual(s.skillTraining, { atletismo: 1, historia: 1 });
});

test('attribute bonus stops at 20 and never lowers a value', () => {
  const origin = find(origins, 'Monge');
  for (const [value, expected] of [
    [18, 20],
    [19, 20],
    [20, 20],
    [23, 23],
  ]) {
    const s = sheet({ autoOrigin: true });
    s.attributes['Força'] = value;
    assert.equal(applyAuto(s, { origin }).attributes['Força'], expected);
  }
});

test('changing origin replaces the previous benefits', () => {
  let s = applyAuto(sheet({ autoOrigin: true, originSkills: ['atletismo'] }), {
    origin: find(origins, 'Monge'),
  });
  s = applyAuto({ ...s, originSkills: ['persuasao'] }, { origin: find(origins, 'Ator') });
  assert.equal(s.attributes['Força'], 10);
  assert.equal(s.attributes['Presença'], 12);
  assert.deepEqual(s.skillTraining, { persuasao: 1 });
  assert.deepEqual(s.saves, { Presença: true });
  s = applyAuto({ ...s, autoOrigin: false }, { origin: find(origins, 'Ator') });
  assert.deepEqual([s.attributes['Presença'], s.skillTraining, s.saves], [10, {}, {}]);
});

test('class grants mastery and keeps the best level', () => {
  const hunter = find(classes, 'Hunter Médico');
  const s = applyAuto(sheet({ autoHunter: true, autoOrigin: true, originSkills: ['medicina'] }), {
    hunter,
    origin: find(origins, 'Iniciado em Medicina'),
  });
  assert.equal(s.skillTraining.medicina, 2);
  const g = grants(sheet({ autoHunter: true, hunterSkills: ['nen', 'sorte', 'ciencia'] }), {
    hunter: find(classes, 'Sem Classe'),
  });
  assert.deepEqual(Object.keys(g.skills), ['nen', 'sorte']);
});

test('old sheets keep their values until the option is enabled', () => {
  const origin = find(origins, 'Monge');
  const old = sheet({ origin: 'Monge' });
  old.attributes['Força'] = 16;
  const s = applyAuto(prepareEdit(old, { origin }), { origin });
  assert.equal(s.attributes['Força'], 16);
  assert.equal(applyAuto({ ...s, autoOrigin: true }, { origin }).attributes['Força'], 18);
});

test('edits made by an older client are not lost or doubled', () => {
  const origin = find(origins, 'Monge');
  const saved = applyAuto(sheet({ autoOrigin: true, originSkills: ['atletismo'] }), { origin });
  const changed = {
    ...saved,
    attributes: { ...saved.attributes, Força: 14, Presença: 13 },
    skillTraining: { ...saved.skillTraining, sorte: 2 },
  };
  const s = applyAuto(prepareEdit(changed, { origin }), { origin });
  assert.equal(s.attributes['Força'], 14);
  assert.equal(s.attributes['Presença'], 13);
  assert.equal(s.skillTraining.sorte, 2);
  const again = applyAuto(prepareEdit(saved, { origin }), { origin });
  for (const k of ['base', 'attributes', 'skillTraining', 'saves'])
    assert.deepEqual(again[k], saved[k]);
});

test('species and category catalogs are complete', () => {
  assert.deepEqual([species.length, categories.length], [3, 7]);
  for (const s of species) {
    assert.ok(s.summary && s.basePve && s.speed && s.variants.length >= 3, s.name);
    for (const v of s.variants) {
      for (const id of Object.keys(v.skillGrants || {})) assert.ok(skills.includes(id), v.name);
      for (const a of v.saves || []) assert.ok(attrs.includes(a), v.name);
    }
  }
  assert.equal(new Set(traits.map((t) => t.id)).size, traits.length);
  for (const c of categories) {
    assert.ok(attrs.includes(c.main) && c.summary && c.features.length, c.name);
    assert.equal(c.saves.length + (c.saveChoice?.count || 0), 2, c.name);
    for (const p of c.paths)
      for (const id of Object.keys(p.skillGrants || {})) assert.ok(skills.includes(id), p.name);
  }
});

test('species gives two attribute points, vitality, speed and variant grants', () => {
  const human = find(species, 'Humano');
  const entry = { species: human };
  const one = applyAuto(sheet({ autoSpecies: true, speciesAttrs: ['Força', 'Força'] }), entry);
  assert.equal(one.attributes['Força'], 12);
  assert.deepEqual([one.pveMax, one.speed], [3, 6]);
  const two = applyAuto(
    sheet({
      autoSpecies: true,
      speciesAttrs: ['Força', 'Presença'],
      speciesVariant: 'Tribo Gyudondond',
    }),
    entry,
  );
  assert.deepEqual([two.attributes['Força'], two.attributes['Presença']], [11, 11]);
  assert.deepEqual(two.skillTraining, { sobrevivencia: 1, sobrenatural: 1 });
  assert.deepEqual(two.saves, { Constituição: true });
});

test('species and origin bonuses add up but stop at 20', () => {
  const entries = { species: find(species, 'Humano'), origin: find(origins, 'Monge') };
  const s = sheet({ autoSpecies: true, autoOrigin: true, speciesAttrs: ['Força', 'Força'] });
  assert.equal(applyAuto(s, entries).attributes['Força'], 14);
  s.attributes['Força'] = 17;
  assert.equal(applyAuto(s, entries).attributes['Força'], 20);
});

test('category computes saves, life, aura, resistance and attack', () => {
  const entries = {
    species: find(species, 'Humano'),
    nen: find(categories, 'Aprimorador'),
    traits,
  };
  const s = sheet({ level: 1, autoNen: true, autoSpecies: true, nenSaves: ['Força', 'Agilidade'] });
  s.attributes['Força'] = 17;
  s.attributes['Constituição'] = 16;
  let t = applyAuto(s, entries);
  assert.deepEqual(t.saves, { Constituição: true, Força: true });
  // 12 do dado + 3 da espécie + 3 de Constituição
  assert.deepEqual([t.pvMax, t.pveMax, t.paMax, t.cr, t.attackBonus], [18, 6, 20, 13, 5]);
  t = applyAuto({ ...s, level: 5 }, entries);
  assert.deepEqual([t.pvMax, t.paMax, t.cr, t.attackBonus], [58, 100, 15, 6]);
  t = applyAuto({ ...s, level: 14, nenPath: 'Aprimorador Físico' }, entries);
  assert.equal(t.pvMax, 18 + 13 * 15);
  t = applyAuto({ ...s, level: 21, proficiency: 6 }, entries);
  assert.deepEqual([t.pvMax, t.paMax], [18 + 19 * 10 + 10, 420]);
  t = applyAuto({ ...s, level: 2, nenPath: 'Aprimorador Mental' }, entries);
  assert.deepEqual([t.skillTraining, t.saves.Sabedoria], [{ percepcao: 1, intuicao: 2 }, true]);
  assert.equal(
    applyAuto({ ...s, level: 1, nenPath: 'Aprimorador Mental' }, entries).saves.Sabedoria,
    undefined,
  );
});

test('no category and chimera ant traits', () => {
  const entries = {
    species: find(species, 'Formiga Quimera'),
    nen: find(categories, 'Sem Categoria'),
    traits,
  };
  const s = sheet({
    level: 1,
    autoNen: true,
    autoSpecies: true,
    speciesVariant: 'Bestial',
    speciesTraits: ['deslocamento-superior', 'deslocamento-animal', 'criatura-robusta'],
  });
  const t = applyAuto(s, entries);
  assert.deepEqual([t.pvMax, t.pveMax, t.speed], [21, 6, 10]);
});

test('manual fields win and leaving automatic restores the base', () => {
  const entries = { species: find(species, 'Humano'), nen: find(categories, 'Emissor'), traits };
  const s = sheet({ level: 3, pvMax: 40, pveMax: 9, paMax: 7, cr: 18, speed: 6, attackBonus: 1 });
  const on = applyAuto({ ...s, autoNen: true, manual: { pvMax: true, cr: true } }, entries);
  assert.deepEqual([on.pvMax, on.cr, on.paMax], [40, 18, 60]);
  const off = applyAuto({ ...on, autoNen: false }, entries);
  assert.deepEqual([off.pvMax, off.cr, off.paMax, off.attackBonus], [40, 18, 7, 1]);
  // Um cliente antigo alterou a aura: o valor dele é mantido como manual.
  const edited = prepareEdit({ ...on, paMax: 99 }, entries);
  assert.equal(applyAuto(edited, entries).paMax, 99);
  // Ficha da v0.7, com base sem os campos calculados.
  const old = { ...s, base: { attributes: s.attributes, skillTraining: {}, saves: {} } };
  assert.equal(applyAuto(prepareEdit(old, entries), entries).pvMax, 40);
});
