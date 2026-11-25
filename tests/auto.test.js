import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyAuto, grants, prepareEdit } from '../src/auto.js';

const load = (f) =>
  JSON.parse(fs.readFileSync(new URL(`../src/data/${f}.json`, import.meta.url))).entries;
const origins = load('origens');
const classes = load('classes_hunter');
const skills = load('pericias').map((s) => s.id);
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
