// Cooking, page side: RuneLite's CookingPlugin / CookingOverlay / FermentTimer for the 2004
// game. Counts what you cook and burn from the game's messages (Lost City's own, from
// cooking.json, plus RuneLite's), shows RuneLite's panel ("Cooking" in green while you cook,
// "NOT cooking" in red, "Cooked: 12 (340/hr)", "Burnt: 2 (14.3%)"), and a jug of wine info
// box counting down while new wine ferments (20 ticks in Lost City's script).
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const COOK_TIMEOUT = 3000; // RuneLite: still "Cooking" for 3 s after the last one
  const FERMENT = 20 * 600; // settimer(fermenting_wine, 20)
  const ANIMS = [896, 897]; // human_cooking, human_firecooking (pack/seq.pack, 274 and 377)
  // RuneLite's own (OSRS) wording, for messages Lost City's tables don't have yet
  const RL_COOKED = /^(You successfully (cook|bake|fry|scramble)|You manage to cook|You roast a|You spit-roast|You cook|You half-cook|You dry a piece of meat)/;
  const RL_BURNT = /^(You accidentally burn|You burn the mushroom in the fire\.|You accidentally spoil)/;

  let cfg = {};
  let cooked = [];
  let burnt = [];
  let session = null; // { start, last, cooked, burnt }
  let ferment = 0; // when the wine is ready (performance.now), 0 = none

  function chat(msg) {
    if (!msg || msg.kind !== 'game') return;
    const text = String(msg.text || '').replace(/@[a-z0-9~]{3}@/gi, '').trim();
    const now = performance.now();
    if (/^You squeeze the grapes into the jug\. The wine begins to ferment\./.test(text)) {
      ferment = now + FERMENT; // a new jug starts the timer again, as the game's settimer does
      return;
    }
    // "You cook the chicken on the fire..." starts it; it isn't the result
    if (/\.\.\.$/.test(text)) return;
    const isBurnt = burnt.some((r) => r.test(text)) || RL_BURNT.test(text);
    const isCooked = !isBurnt && (cooked.some((r) => r.test(text)) || RL_COOKED.test(text));
    if (!isBurnt && !isCooked) return;
    if (!session) session = { start: now, last: now, cooked: 0, burnt: 0 };
    session.last = now;
    if (isBurnt) session.burnt++;
    else session.cooked++;
  }

  function cooking() {
    const c = ll.client;
    const me = c && c[ll.fields.localPlayer];
    return !!me && ANIMS.includes(me[ll.fields.primaryAnim]);
  }

  function panels(now) {
    if (!session) return [];
    const timeout = Math.max(0, Number(cfg.statTimeout === undefined ? 5 : cfg.statTimeout)) * 60000;
    if (timeout && now - session.last > timeout) {
      session = null;
      return [];
    }
    const active = cooking() || now - session.last < COOK_TIMEOUT;
    const hours = Math.max(1, now - session.start) / 3600000;
    const total = session.cooked + session.burnt;
    const pct = total ? Math.round((session.burnt / total) * 1000) / 10 : 0;
    return [{
      name: 'Cooking',
      size: cfg.panelSize,
      rows: [
        { type: 'title', text: active ? 'Cooking' : 'NOT cooking', colour: active ? 0x00ff00 : 0xff0000 },
        { type: 'line', left: 'Cooked:', right: `${session.cooked}${session.cooked >= 1 ? ` (${Math.round(session.cooked / hours)}/hr)` : ''}` },
        { type: 'line', left: 'Burnt:', right: `${session.burnt}${session.burnt >= 1 ? ` (${pct}%)` : ''}` },
      ],
    }];
  }

  function boxes(now) {
    if (!ferment || cfg.fermentTimer === false) return [];
    const left = Math.ceil((ferment - now) / 1000);
    if (left <= 0) {
      ferment = 0;
      return [];
    }
    return [{
      name: 'Wine ferment', kind: 'fermentTimer', group: 'Other', priority: 4,
      image: ll.itemIcon ? ll.itemIcon(1993) : null, // jug of wine
      text: String(left), colour: left <= 3 ? 0xff0000 : 0xffffff, tooltip: 'Wine fermenting',
    }];
  }

  if (ll.addOverlayPanel) ll.addOverlayPanel('cooking', panels);
  if (ll.addInfoBoxes) ll.addInfoBoxes('cooking', boxes);

  ll.__cooking = { chat, panels, boxes, session: () => session };

  ll.registerPlugin('cooking', {
    configure(config) {
      cfg = config || {};
      if (cfg.messages) {
        cooked = (cfg.messages.cooked || []).map((s) => new RegExp(s));
        burnt = (cfg.messages.burnt || []).map((s) => new RegExp(s));
      }
    },
    chat,
    stop() {
      session = null;
      ferment = 0;
    },
  });
})();
