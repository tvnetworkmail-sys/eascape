'use strict';
// Quest Helper engine: works out how far you are in each quest and which step comes next.
//
// Lost City doesn't send quest progress to the game (only the quest list colour), so the
// stage is pieced together from what the game shows, and saved per account:
//   - the quest list colour: red not started, yellow started, green done
//   - the quest journal, when you open it: its text belongs to one stage (or a few)
//   - conversations: lines that are only said as the stage moves on (progress.json)
// Then the guide's rules for that stage pick the step from what you carry, wear and where
// you are, like Quest Helper's ConditionalStep.

const COMPLETE = 1e6;

function norm(s) {
  return String(s == null ? '' : s)
    .replace(/@[a-z0-9]{3}@/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

class QuestEngine {
  constructor({ progress, guides }) {
    this.progress = progress; // { quests: { key: { name, com, complete, journal, dialogue } } }
    this.guides = guides; // { key: guide }
    this.state = { quests: {}, bank: null };
  }

  load(saved) {
    this.state = saved && typeof saved === 'object' ? { quests: saved.quests || {}, bank: saved.bank || null } : { quests: {}, bank: null };
  }

  save() {
    return this.state;
  }

  quest(key) {
    if (!this.state.quests[key]) this.state.quests[key] = { stage: 0, sure: false, flags: {} };
    return this.state.quests[key];
  }

  completeStage(key) {
    const p = this.progress.quests[key];
    return p && Number.isFinite(p.complete) ? p.complete : COMPLETE;
  }

  /** The first stage after "not started" (Romeo & Juliet counts in tens). */
  firstStage(key) {
    const p = this.progress.quests[key];
    let best = Infinity;
    for (const b of (p && p.journal) || []) if (b.lo > 0 && b.lo < best) best = b.lo;
    const g = this.guides[key];
    for (const s of (g && g.stages) || []) if (s.lo > 0 && s.lo < best) best = s.lo;
    return Number.isFinite(best) ? best : 1;
  }

  status(key) {
    const q = this.state.quests[key];
    if (!q) return 'unknown';
    if (q.stage >= this.completeStage(key)) return 'done';
    return q.stage > 0 ? 'started' : q.listed ? 'not started' : 'unknown';
  }

  // ---------------------------------------------------------------- inputs

  /** Quest list colours: { key: 'red' | 'yellow' | 'green' }. Returns the keys that changed. */
  questList(colours) {
    const changed = [];
    for (const [key, colour] of Object.entries(colours)) {
      if (!this.progress.quests[key]) continue;
      const q = this.quest(key);
      const before = `${q.stage}|${q.sure}`;
      q.listed = true;
      const done = this.completeStage(key);
      if (colour === 'red') {
        if (q.stage !== 0) q.flags = {};
        q.stage = 0;
        q.sure = true;
      } else if (colour === 'green') {
        q.stage = Math.max(q.stage, done);
        q.sure = true;
      } else if (colour === 'yellow') {
        if (q.stage <= 0 || q.stage >= done) {
          q.stage = this.firstStage(key);
          q.sure = false; // somewhere in the quest: the journal will tell
        }
      }
      if (`${q.stage}|${q.sure}` !== before) changed.push(key);
    }
    return changed;
  }

  /** The quest journal's text (all lines). Returns { quest, stage } or null. */
  journal(lines) {
    const shown = ` ${norm([].concat(lines).join(' '))} `;
    if (shown.trim().length < 10) return null;
    let best = null;
    for (const [key, p] of Object.entries(this.progress.quests)) {
      // A guide can give its own journal stages (journals Lost City builds up piece by piece)
      const g0 = this.guides[key];
      const branches = g0 && g0.journal ? g0.journal : p.journal || [];
      for (const b of branches) {
        const texts = b.texts || [];
        if (!texts.length) continue;
        let hit = 0;
        let len = 0;
        for (const t of texts) {
          if (shown.includes(` ${t} `)) {
            hit++;
            len += t.length;
          }
        }
        if (!hit || len < 18) continue;
        // The branch that accounts for most of the text wins (earlier stages share their
        // opening paragraphs with later ones); ties go to the one with fewer texts missing.
        const score = len + hit / texts.length;
        if (!best || score > best.score) best = { key, b, score, len };
      }
    }
    if (!best || best.len < 0.4 * shown.trim().length) return null;
    this.flagsFrom(shown, []);
    const { key, b } = best;
    const q = this.quest(key);
    const g = this.guides[key];
    let stage;
    if (g && g.journalCount) {
      const m = new RegExp(g.journalCount.re).exec(shown);
      if (m) stage = g.journalCount.a * Number(m[1]) + g.journalCount.b;
    }
    if (stage === undefined) {
      const lo = Math.max(b.lo, b.lo <= 0 && b.hi > 0 ? this.firstStage(key) : b.lo);
      const hi = Math.min(b.hi, COMPLETE);
      if (lo === hi) stage = lo;
      else if (q.stage >= lo && q.stage <= hi) stage = q.stage;
      else stage = lo;
      q.sure = lo === hi || hi >= this.completeStage(key);
    } else {
      q.sure = true;
    }
    if (b.lo === b.hi) q.sure = true;
    if (stage !== q.stage) q.flags = q.flags || {};
    q.stage = stage;
    q.listed = true;
    return { quest: key, stage };
  }

  /** Text shown in a conversation (all lines joined). Returns the quests whose stage moved. */
  dialogue(text) {
    const shown = ` ${norm(text)} `;
    if (shown.trim().length < 6) return [];
    const changed = [];
    for (const [key, p] of Object.entries(this.progress.quests)) {
      for (const [t, stage] of Object.entries(p.dialogue || {})) {
        if (!shown.includes(` ${t} `)) continue;
        const q = this.quest(key);
        if (stage > q.stage || (!q.sure && stage === q.stage)) {
          q.stage = stage;
          q.sure = true;
          changed.push(key);
        }
      }
    }
    this.flagsFrom(shown, changed);
    return changed;
  }

  /** A game message in the chat box. */
  message(text) {
    const changed = [];
    this.flagsFrom(` ${norm(text)} `, changed);
    return changed;
  }

  flagsFrom(shown, changed) {
    for (const [key, g] of Object.entries(this.guides)) {
      for (const [name, f] of Object.entries(g.flags || {})) {
        const q = this.state.quests[key];
        if (!q) continue;
        q.flags = q.flags || {};
        if (f.on.some((t) => shown.includes(` ${t} `)) && !q.flags[name]) {
          q.flags[name] = true;
          changed.push(key);
        }
        if (f.off.some((t) => shown.includes(` ${t} `)) && q.flags[name]) {
          delete q.flags[name];
          changed.push(key);
        }
      }
    }
  }

  /** Bank contents (when the bank is open): [{id, quantity}]. */
  bank(items) {
    const m = {};
    for (const it of items || []) if (it && it.id >= 0) m[it.id] = (m[it.id] || 0) + (it.quantity || 1);
    this.state.bank = m;
  }

  /** Lets you correct the stage by hand from the sidebar. */
  setStage(key, stage) {
    const q = this.quest(key);
    q.stage = stage;
    q.sure = true;
    q.flags = {};
  }

  // ---------------------------------------------------------------- guide

  count(item, have) {
    let n = 0;
    for (const id of item.ids) n += have.inv[id] || 0;
    if (item.worn) for (const id of item.ids) if (have.worn[id]) n++;
    return n;
  }

  need(key, item) {
    const q = this.state.quests[key];
    if (item.qtyFromStage && q && q.stage > 0) return Math.max(1, item.qtyFromStage[0] * q.stage + item.qtyFromStage[1]);
    return item.qty || 1;
  }

  check(key, cond, have) {
    if (!cond) return true;
    const g = this.guides[key];
    const q = this.quest(key);
    if (cond.not) return !this.check(key, cond.not, have);
    if (cond.or) return cond.or.some((c) => this.check(key, c, have));
    if (cond.and) return cond.and.every((c) => this.check(key, c, have));
    if (cond.have) {
      const it = g.items[cond.have];
      return this.count(it, have) >= (cond.qty || 1);
    }
    if (cond.wear) return g.items[cond.wear].ids.some((id) => have.worn[id]);
    if (cond.in) {
      const [x1, z1, x2, z2, level] = g.zones[cond.in];
      const p = have.pos;
      return !!p && p.level === level && p.x >= Math.min(x1, x2) && p.x <= Math.max(x1, x2) && p.z >= Math.min(z1, z2) && p.z <= Math.max(z1, z2);
    }
    if (cond.seen) return !!(q.flags && q.flags[cond.seen]);
    if (cond.npc) return cond.npc.some((id) => have.npcs && have.npcs.has(id));
    if (cond.level !== undefined) return !!have.pos && have.pos.level === cond.level;
    if (cond.stage) {
      const s = q.stage;
      return { '>=': s >= cond.n, '<=': s <= cond.n, '=': s === cond.n, '<': s < cond.n, '>': s > cond.n }[cond.stage];
    }
    return false;
  }

  /**
   * The step to do now. have: { inv: {id: qty}, worn: {id: true}, pos: {x, z, level},
   * npcs: Set(npc ids in the scene) }. Returns { id, step, stage, sure } or a status.
   */
  current(key, have) {
    const g = this.guides[key];
    if (!g) return null;
    const q = this.quest(key);
    if (q.stage >= this.completeStage(key)) return { done: true, stage: q.stage, sure: q.sure };
    // Nothing known yet (the quest list hasn't been read): don't guess "not started".
    if (!q.listed && !q.sure && q.stage === 0) return { waiting: true, stage: 0, sure: false };
    if (q.pinned && g.steps[q.pinned] && q.pinnedStage === q.stage) return { id: q.pinned, step: g.steps[q.pinned], stage: q.stage, sure: q.sure, pinned: true };
    const table = g.stages.find((s) => q.stage >= s.lo && q.stage <= s.hi);
    if (!table) return { unknown: true, stage: q.stage, sure: q.sure };
    for (const r of table.rules) {
      if (this.check(key, r.if, have)) return { id: r.step, step: g.steps[r.step], stage: q.stage, sure: q.sure };
    }
    return { unknown: true, stage: q.stage, sure: q.sure };
  }

  /** "I'm on this step": keep showing it until the stage moves on. */
  pin(key, stepId) {
    const q = this.quest(key);
    q.pinned = stepId || null;
    q.pinnedStage = q.stage;
  }

  /** Item list for the sidebar: [{key, name, need, have, bank, tip}]. */
  itemList(key, keys, have) {
    const g = this.guides[key];
    const bank = this.state.bank;
    return keys.map((k) => {
      const it = g.items[k];
      const need = this.need(key, it);
      let inBank = null;
      if (bank) {
        inBank = 0;
        for (const id of it.ids) inBank += bank[id] || 0;
      }
      return { key: k, name: it.name, need, have: this.count(it, have), bank: inBank, tip: it.tip, ids: it.ids };
    });
  }
}

module.exports = { QuestEngine, norm, COMPLETE };
