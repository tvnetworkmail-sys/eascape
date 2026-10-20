#!/usr/bin/env node
'use strict';
// Turns one of the app's old guide sources (tools/quests/guides/<quest>.js, written for Lost
// City's 2004 quests) into the server's Quest Helper rows (a questhelper_guide row and a
// questhelper_step row per step), numbering the steps in the order of the guide's sections.
// The proc that picks the step is written by hand next to the quest (the old guides' stage
// rules guessed from the client; the server knows the quest's varps).
// Usage: to_server.js <quest> <guide number> <quest name> <journal title>   (prints the .dbrow, and the step numbers)
const path = require('path');
const [quest, num, name, journal] = process.argv.slice(2);
const g = require(path.join(__dirname, 'guides', `${quest}.js`));
const coord = ([x, z, level]) => `${level}_${x >> 6}_${z >> 6}_${x & 63}_${z & 63}`;
const q = (s) => (/[,"]/.test(s) ? `"${String(s).replace(/"/g, "'")}"` : s);
const items = (keys) => [].concat(keys || []).map((k) => g.items[k]).filter(Boolean);
const out = [];
out.push(`// Quest Helper guide for ${name || quest}: made from the app's old guide (tools/quests/guides/${quest}.js,`);
out.push("// after RuneLite's Quest Helper by Zoinkwiz, BSD 2-Clause) by app/tools/quests/to_server.js.");
out.push(`[questhelper_guide_${quest}]`, 'table=questhelper_guide', `data=guide,^qh_${quest}`, `data=key,${quest}`);
out.push(`data=name,${q(name || g.name || quest)}`, `data=journal,${q(journal || name || quest)}`);
if (g.difficulty) out.push(`data=difficulty,${g.difficulty}`);
if (g.start) out.push(`data=start,${q(g.start)}`);
for (const it of items(g.required)) out.push(`data=required,${[].concat(it.obj)[0]},${it.qty || 1}`);
for (const it of items(g.recommended)) out.push(`data=recommended,${[].concat(it.obj)[0]},${it.qty || 1}`);
for (const s of g.skills || []) out.push(`data=skill,${q(s)}`);
for (const r of g.rewards || []) out.push(`data=reward,${q(r)}`);
for (const sec of g.sections) out.push(`data=section,${q(sec.title)}`);
// steps only the stage rules use (climbUpMiddle...) go after the step they're a part of
const listed = new Set(g.sections.flatMap((s) => s.steps));
for (const id of Object.keys(g.steps)) {
  if (listed.has(id)) continue;
  const host = [...listed].filter((x) => id.startsWith(x)).sort((a, b) => b.length - a.length)[0];
  const sec = host ? g.sections.find((s) => s.steps.includes(host)) : g.sections[g.sections.length - 1];
  sec.steps.splice(host ? sec.steps.indexOf(host) + 1 : sec.steps.length, 0, id);
  listed.add(id);
}
let n = 0;
const map = [];
g.sections.forEach((sec, si) => {
  for (const id of sec.steps) {
    const st = g.steps[id];
    n++;
    map.push(`${n} ${id}`);
    out.push('', `[questhelper_step_${quest}_${n}]`, 'table=questhelper_step', `data=id,${Number(num) * 100 + n}`, `data=section,${si}`, `data=text,${q(st.text)}`);
    for (const x of [].concat(st.npc || [])) out.push(`data=npc,${x}`);
    if (st.loc) out.push(`data=loc,${[].concat(st.loc)[0]}`);
    for (const x of [].concat(st.obj || [])) out.push(`data=obj,${x}`);
    if (st.at) out.push(`data=coord,${coord(st.at)}`);
    for (const o of st.options || []) out.push(`data=option,${q(o)}`);
    for (const it of items(st.items)) out.push(`data=item,${[].concat(it.obj)[0]},${it.qty || 1}`);
    if (st.dig) out.push('data=dig,true');
  }
});
console.log(out.join('\n'));
console.error(map.join('\n'));
