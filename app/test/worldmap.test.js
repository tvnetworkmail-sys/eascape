'use strict';
// The rendered world map ships complete: every region the index lists has its picture, the
// main towns are there, and icons/labels load.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'ui', 'assets', 'worldmap');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
let count = 0;
for (const [lv, list] of Object.entries(index.levels)) {
  for (const [rx, rz] of list) {
    assert.ok(fs.existsSync(path.join(dir, lv, `${rx}_${rz}.png`)), `level ${lv} region ${rx}_${rz} picture`);
    count++;
  }
}
const ground = new Set(index.levels['0'].map(([x, z]) => `${x}_${z}`));
for (const [name, x, z] of [['Lumbridge', 3222, 3218], ['Varrock', 3212, 3428], ['Falador', 2965, 3380], ['Al Kharid', 3293, 3174]]) {
  assert.ok(ground.has(`${x >> 6}_${z >> 6}`), `${name} on the map`);
}
const labels = JSON.parse(fs.readFileSync(path.join(dir, 'labels.json'), 'utf8'));
assert.ok(labels.some((l) => l.text.join(' ') === 'Lumbridge'));
const icons = JSON.parse(fs.readFileSync(path.join(dir, 'icons.json'), 'utf8'));
assert.ok(icons.length > 100, 'map icons');
console.log(`world map: ok (${count} pictures, ${icons.length} icons, ${labels.length} labels)`);
