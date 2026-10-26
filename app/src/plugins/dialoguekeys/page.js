// Dialogue Keys, page side. While a conversation is open in the chat box (the game ignores
// typing then), Space presses its "Click here to continue" button and 1-5 press its option
// buttons, top to bottom, through the game's own button handling (ll.pressButton), exactly
// as a click would. Option numbers are added to the option text the server sent.
(function () {
  'use strict';
  const ll = window.__lostlite;
  if (!ll || !ll.registerPlugin) return;

  const PAUSE = 6; // BUTTON_CONTINUE
  const OK = 1; // BUTTON_OK
  const NUMBERED = /^\d\. /;
  let cfg = {};
  // Interface fields not read by the patcher, found on first use from the objects themselves.
  let childrenKey = null;
  let textKey = null;
  const numbered = new Set(); // com ids we put numbers on

  /** The array of child ids: the first array property whose entries are coms that say this
   *  one is their layer. */
  function findChildren(list, root) {
    const f = ll.fields;
    for (const k of Object.keys(root)) {
      const v = root[k];
      if (!Array.isArray(v) || !v.length || !v.every((x) => Number.isInteger(x) && list[x])) continue;
      const first = list[v[0]];
      const layerKeys = Object.keys(first).filter((lk) => lk !== f.comId && first[lk] === root[f.comId]);
      if (layerKeys.some((lk) => v.every((x) => list[x][lk] === root[f.comId]))) return k;
    }
    return null;
  }

  /** The text shown: the first string property that isn't the button's menu text. */
  function findText(com) {
    const f = ll.fields;
    for (const k of Object.keys(com)) if (k !== f.comButtonText && typeof com[k] === 'string' && com[k]) return k;
    return null;
  }

  /** The open conversation's buttons in order: { pause: [ids], options: [coms] }, or null. */
  function dialogue() {
    const c = ll.client;
    const f = ll.fields;
    if (!c || !ll.loggedIn || !f.chatModal || !f.comButtonType || !ll.api || !ll.api.ifList) return null;
    const id = c[f.chatModal];
    if (typeof id !== 'number' || id < 0) return null;
    if ((f.dialogInputOpen && c[f.dialogInputOpen]) || (f.socialInputOpen && c[f.socialInputOpen])) return null;
    const list = ll.api.ifList();
    const root = list && list[id];
    if (!root) return null;
    if (!childrenKey) childrenKey = f.comChildren || findChildren(list, root);
    if (!childrenKey) return null;
    const out = { pause: [], options: [] };
    const walk = (com, depth) => {
      if (!com || depth > 4 || (f.comHide && com[f.comHide])) return;
      if (com[f.comButtonType] === PAUSE) out.pause.push(com[f.comId]);
      else if (com[f.comButtonType] === OK) out.options.push(com);
      for (const ch of com[childrenKey] || []) walk(list[ch], depth + 1);
    };
    walk(root, 0);
    return out;
  }

  function addNumbers(d) {
    if (!d) return;
    let changed = false;
    d.options.forEach((com, i) => {
      if (!textKey) textKey = ll.fields.comText || findText(com);
      const t = textKey && com[textKey];
      if (typeof t !== 'string' || !t || NUMBERED.test(t) || i > 8) return;
      com[textKey] = `${i + 1}. ${t}`;
      numbered.add(com[ll.fields.comId]);
      changed = true;
    });
    if (changed && ll.fields.redrawChat) ll.client[ll.fields.redrawChat] = true;
  }

  function removeNumbers() {
    const list = ll.api && ll.api.ifList ? ll.api.ifList() : null;
    if (list && textKey) {
      for (const id of numbered) {
        const com = list[id];
        if (com && typeof com[textKey] === 'string') com[textKey] = com[textKey].replace(NUMBERED, '');
      }
      if (numbered.size && ll.client && ll.fields.redrawChat) ll.client[ll.fields.redrawChat] = true;
    }
    numbered.clear();
  }

  function frame() {
    if (cfg.showNumbers && cfg.numberOptions) addNumbers(dialogue());
  }

  function key(e, down) {
    if (!down || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return false;
    const space = e.key === ' ' || e.code === 'Space';
    const digit = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
    if (!(space && cfg.spaceContinue) && !(digit && cfg.numberOptions)) return false;
    const d = dialogue();
    if (!d) return false;
    if (space) {
      if (!d.pause.length) return false;
      return ll.pressButton(d.pause[0], 'pause') ? 'stop' : false;
    }
    const com = d.options[digit - 1];
    if (!com || d.pause.length) return false;
    return ll.pressButton(com[ll.fields.comId], 'ok') ? 'stop' : false;
  }

  ll.registerPlugin('dialoguekeys', {
    configure(config) {
      cfg = config || {};
      ll.dialogueFeedback = cfg.highlightChoice !== false;
      if (!cfg.showNumbers || !cfg.numberOptions) removeNumbers();
    },
    frame,
    key,
    stop() {
      removeNumbers();
      ll.dialogueFeedback = false;
      cfg = {};
    },
  });

  ll.__dialogueKeys = { dialogue, key };
})();
