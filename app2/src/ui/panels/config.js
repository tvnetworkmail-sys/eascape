'use strict';
// RuneLite's configuration UI, 1:1:
//   TopLevelConfigPanel - MaterialTabGroup (Configuration, Profiles) over a card layout
//   PluginListPanel     - IconTextField search, then the plugins (pinned first, by name) as
//                         PluginListItem rows: star, name (orange on hover, click for a menu),
//                         cog (Edit plugin configuration), PluginToggleButton
//   ConfigPanel         - back, title, toggle; sections (collapsible) and items sorted by
//                         position then name; one control per item type; Reset and Back
//   ProfilePanel        - profiles: switch, rename, duplicate, delete
// Item types (our descriptors -> RuneLite's): boolean -> JCheckBox, int / double -> JSpinner
// (with @Range and @Units), string -> JTextArea (secret -> JPasswordField), color -> ColorJButton
// (+ @Alpha), enum -> JComboBox, hotkey -> HotkeyButton; and ours: itemlist (a text area, as RuneLite keeps item lists).
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h, icon } = UI;
  const PINNED_KEY = 'pinnedPlugins';

  const view = {
    tab: 'plugins', // 'plugins' | 'profiles'
    editing: null, // plugin id whose settings are open
    search: '',
    openSections: {},
    renamingProfile: null,
    scroll: 0,
  };

  // ---------------------------------------------------------------- helpers

  function plugins() {
    return App.state.plugins || [];
  }

  function pinned() {
    return String(App.config('lostlite', PINNED_KEY, '')).split(',').filter(Boolean);
  }

  function setPinned(id, on) {
    const list = pinned().filter((x) => x !== id);
    if (on) list.push(id);
    App.setConfig('lostlite', PINNED_KEY, list.join(','));
  }

  function setEnabled(id, on) {
    const p = plugins().find((x) => x.id === id);
    if (p) p.enabled = on;
    window.lostlite.setPluginEnabled(id, on);
  }

  // PluginSearch / Text.matchesSearchTerms: the keywords are the name's and description's words
  // (lower case), the tags and "plugin"; every search word must be in a keyword, or close to one
  // (commons-text 1.2 JaroWinklerDistance above 0.9)
  function jaroWinkler(a, b) {
    if (a === b) return 1;
    const [mx, mn] = a.length > b.length ? [a, b] : [b, a];
    const range = Math.max(Math.floor(mx.length / 2) - 1, 0);
    const mIdx = new Array(mn.length).fill(-1);
    const mFlags = new Array(mx.length).fill(false);
    let matches = 0;
    for (let i = 0; i < mn.length; i++) {
      for (let j = Math.max(i - range, 0), end = Math.min(i + range + 1, mx.length); j < end; j++) {
        if (!mFlags[j] && mn[i] === mx[j]) { mIdx[i] = j; mFlags[j] = true; matches++; break; }
      }
    }
    if (!matches) return 0;
    const ms1 = []; const ms2 = [];
    for (let i = 0; i < mn.length; i++) if (mIdx[i] !== -1) ms1.push(mn[i]);
    for (let j = 0; j < mx.length; j++) if (mFlags[j]) ms2.push(mx[j]);
    let transpositions = 0;
    for (let i = 0; i < ms1.length; i++) if (ms1[i] !== ms2[i]) transpositions++;
    let prefix = 0;
    for (let i = 0; i < mn.length && a[i] === b[i]; i++) prefix++;
    const m = matches; const t = Math.floor(transpositions / 2);
    const j = (m / a.length + m / b.length + (m - t) / m) / 3;
    const jw = j < 0.7 ? j : j + Math.min(0.1, 1 / mx.length) * Math.min(prefix, 4) * (1 - j);
    return Math.round(jw * 100) / 100;
  }
  const words = (s) => String(s || '').split(' ').map((x) => x.trim()).filter(Boolean);
  function keywords(p) {
    return [...String(p.name).toLowerCase().split(' '), ...String(p.description || '').toLowerCase().split(' '), ...(p.tags || []), 'plugin'];
  }
  function matches(p, q) {
    if (!q || !q.trim()) return true;
    const kw = keywords(p);
    return words(q.toLowerCase()).every((term) => kw.some((t) => t.includes(term) || jaroWinkler(t, term) > 0.9));
  }
  const strCmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // Java String.compareTo
  /** PluginSearch.comparator */
  function compare(a, b, pins, q) {
    const pa = pins.includes(a.id); const pb = pins.includes(b.id);
    if (!q || !q.trim()) return (pa === pb ? 0 : pa ? -1 : 1) || strCmp(a.name, b.name);
    const pieces = words(q.toLowerCase());
    const keys = (p) => {
      const np = words(p.name.toLowerCase());
      return [pins.includes(p.id), q.toLowerCase() === p.name.toLowerCase(),
        pieces.some((qp) => np.some((n) => n.startsWith(qp))), pieces.every((qp) => np.some((n) => n.includes(qp)))];
    };
    const ka = keys(a); const kb = keys(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] ? -1 : 1;
    return strCmp(a.name, b.name);
  }

  function tipFor(p) {
    return p.description ? `${p.name}:\n${p.description}` : null;
  }

  // ---------------------------------------------------------------- top level

  function render(root, { fresh }) {
    const tab = (id, img, tipText) => h('button.mtab', {
      class: view.tab === id ? 'selected' : null,
      tip: tipText,
      onclick: () => {
        if (view.tab === id) return;
        view.tab = id;
        view.editing = null;
        App.renderPanel(true);
      },
    }, icon(img));
    const tabs = h('div.mtabs', {}, tab('plugins', 'config_icon_lg.png', 'Configuration'), tab('profiles', 'profile_icon.png', 'Profiles'));
    let body;
    if (view.tab === 'profiles') body = profilePanel();
    else if (view.editing) body = configPanel(view.editing);
    else body = pluginList();
    const old = root.querySelector('.rl-scroll');
    const keep = !fresh && old ? old.scrollTop : 0;
    root.replaceChildren(tabs, body);
    const sc = root.querySelector('.rl-scroll');
    if (sc) sc.scrollTop = keep;
    if (view.tab === 'plugins' && !view.editing && fresh) {
      const input = root.querySelector('.text-field input');
      if (input) input.focus();
    }
  }

  // ---------------------------------------------------------------- PluginListPanel

  function pluginList() {
    const list = h('div.rl-main');
    const search = UI.searchField(view.search, (q) => {
      view.search = q;
      fill();
    });
    function fill() {
      const pins = pinned();
      const all = plugins().filter((p) => !p.hidden && matches(p, view.search))
        .sort((a, b) => compare(a, b, pins, view.search));
      list.replaceChildren(...all.map((p) => pluginItem(p, pins.includes(p.id))));
    }
    fill();
    return h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' },
      h('div.rl-top', {}, search),
      h('div.rl-scroll', {}, list));
  }

  function pluginItem(p, isPinned) {
    const pin = h('button.icon-btn.pin', {
      tip: isPinned ? 'Unpin plugin' : 'Pin plugin',
      onclick: () => { setPinned(p.id, !isPinned); App.renderPanel(false); },
    }, icon(isPinned ? 'star_on.png' : 'star_off.png'));
    const hasConfig = p.config && p.config.items.length;
    const name = h('span.name', { text: p.name, tip: tipFor(p) });
    // addLabelPopupMenu: hovering turns it orange, a click opens Configure (and the like)
    name.addEventListener('click', (e) => UI.popup(e, [hasConfig ? ['Configure', () => openConfig(p.id)] : null,
      [isPinned ? 'Unpin' : 'Pin', () => { setPinned(p.id, !isPinned); App.renderPanel(false); }]], 'labelmenu'));
    const btns = h('div.btns');
    if (hasConfig) btns.append(h('button.icon-btn.cfg', { tip: 'Edit plugin configuration', onclick: () => openConfig(p.id) }, icon('config_edit_icon.png')));
    if (!p.alwaysOn) btns.append(UI.toggle(p.enabled, (on) => { setEnabled(p.id, on); App.renderPanel(false); }));
    btns.style.setProperty('--n', btns.children.length || 1);
    return h('div.plugin-item', {}, pin, name, btns);
  }

  function openConfig(id) {
    view.editing = id;
    App.renderPanel(true);
  }

  // ---------------------------------------------------------------- ConfigPanel

  function configPanel(id) {
    const p = plugins().find((x) => x.id === id);
    if (!p) {
      view.editing = null;
      return pluginList();
    }
    const back = () => { view.editing = null; App.renderPanel(true); };
    const title = h('span.title', { text: p.name, tip: tipFor(p) });
    title.addEventListener('click', (e) => UI.popup(e, [['Reset', () => reset(p)]], 'labelmenu'));
    const top = h('div.config-top', {},
      h('button.icon-btn.back', { tip: 'Back', onclick: back }, icon('config_back_icon.png')),
      title,
      p.alwaysOn ? null : UI.toggle(p.enabled, (on) => { setEnabled(id, on); App.renderPanel(false); }));

    const main = h('div.rl-main');
    const cfg = p.config;
    const sections = (cfg.sections || []).slice();
    const items = cfg.items.filter((i) => !i.hidden && !(i.prices && App.config('runelite', 'showPrices', false) !== true));
    const byPos = (a, b) => (a.position || 0) - (b.position || 0) || String(a.name).localeCompare(String(b.name));
    // sections and loose items share one ordering by position, then name (ConfigPanel.rebuild)
    const entries = items.filter((i) => !i.section || !sections.some((s) => s.key === i.section))
      .map((it) => ({ position: it.position || 0, name: it.name, el: () => configItem(cfg.group, it) }));
    for (const s of sections) entries.push({ position: s.position || 0, name: s.name, el: () => sectionEl(s) });
    entries.sort(byPos);
    function sectionEl(s) {
      const key = `${id}.${s.key}`;
      const open = view.openSections[key] !== undefined ? view.openSections[key] : !s.closedByDefault;
      const body = h('div.cfg-section-body', {}, ...items.filter((i) => i.section === s.key).sort(byPos).map((it) => configItem(cfg.group, it)));
      const arrow = h('button.arrow', { tip: open ? 'Retract' : 'Expand' }, icon(open ? 'section_retract.png' : 'section_expand.png'));
      const sec = h('div.cfg-section', { class: open ? null : 'closed' },
        h('div.cfg-section-header', {}, arrow, h('span.sname', { text: s.name, tip: s.description ? `${s.name}:\n${s.description}` : null })),
        body);
      sec.firstChild.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const now = sec.classList.contains('closed');
        view.openSections[key] = now;
        sec.classList.toggle('closed', !now);
        arrow.firstChild.src = 'assets/icons/' + (now ? 'section_retract.png' : 'section_expand.png');
        arrow._tip = now ? 'Retract' : 'Expand';
      });
      return sec;
    }
    for (const t of entries) main.append(t.el());
    main.append(h('button.btn.block', { onclick: () => reset(p) }, 'Reset'));
    main.append(h('button.btn.block', { onclick: back }, 'Back'));
    return h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' }, top, h('div.rl-scroll', {}, main));
  }

  function reset(p) {
    if (!window.confirm("Are you sure you want to reset this plugin's configuration?")) return;
    const cfg = p.config;
    for (const it of cfg.items) App.setConfig(cfg.group, it.key, undefined);
    App.renderPanel(false);
  }

  /** 'config:group.key' names of a plugin's item lists. */
  function listKeys(id) {
    const p = plugins().find((x) => x.id === id);
    if (!p || !p.config) return [];
    return p.config.items.filter((i) => i.type === 'itemlist').map((i) => `config:${p.config.group}.${i.key}`);
  }

  function configItem(group, it) {
    const value = App.config(group, it.key, it.default);
    const set = (v) => App.setConfig(group, it.key, v);
    let control;
    let stack = false;
    switch (it.type) {
      case 'boolean': control = UI.checkbox(!!value, set); break;
      // RuneLite's Notification item: its checkbox (the per-notification settings cog is not cloned yet)
      case 'notification': control = UI.checkbox(!!value, set); break;
      case 'int': control = UI.spinner(Number(value) || 0, it, set); break;
      case 'double': control = UI.spinner(Number(value) || 0, { ...it, step: it.step || 0.1, max: it.max === undefined ? Number.MAX_VALUE : it.max }, set); break;
      case 'enum': control = UI.combo(value, it.options, set); break;
      case 'color': control = UI.colorButton(value, set, { alpha: !!it.alpha, title: it.name }); break;
      case 'hotkey': control = UI.hotkeyButton(value, set); break;
      case 'string': stack = true; control = UI.textArea(value, set, it.secret); break;
      // RuneLite keeps item lists (Ground Items' highlighted / hidden items) as comma-separated
      // text in a JTextArea
      case 'itemlist': stack = true; control = UI.textArea(value, set); break;
      // RuneLite's Set<Enum> item (ConfigPanel.createList): a JList with multiple selection (click toggles here);
      // saved as the enum names joined by commas
      case 'enumset': {
        stack = true;
        const sel = new Set(String(value || '').split(',').filter(Boolean));
        control = h('div.enum-set', {}, ...it.options.map((o) => h('div', {
          class: sel.has(o.value) ? 'sel' : null,
          text: o.label,
          onclick: (ev) => {
            if (sel.has(o.value)) sel.delete(o.value); else sel.add(o.value);
            ev.currentTarget.classList.toggle('sel', sel.has(o.value));
            set(it.options.map((x) => x.value).filter((x) => sel.has(x)).join(','));
          },
        })));
        break;
      }
      default: control = h('span.muted', { text: String(value) });
    }
    const label = h('span.label', { text: it.name, tip: it.description ? `${it.name}:\n${it.description}` : null });
    return h('div.cfg-item', { class: stack ? 'stack' : null }, label, control);
  }

  // other panels (Info Boxes) draw settings the same way
  window.ConfigUI = { item: configItem };

  // ---------------------------------------------------------------- ProfilePanel

  function profilePanel() {
    const { active, list } = App.state.profiles || { list: [] };
    const rows = list.map((pr) => {
      const isActive = pr.id === active;
      let name;
      if (view.renamingProfile === pr.id) {
        const input = h('input', { type: 'text', value: pr.name, spellcheck: 'false' });
        const done = async (save) => {
          view.renamingProfile = null;
          if (save) await window.lostlite.profile('rename', pr.id, input.value);
          App.renderPanel(false);
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
        input.addEventListener('blur', () => done(true));
        setTimeout(() => { input.focus(); input.select(); }, 0);
        name = h('span.pname', {}, input);
      } else {
        name = h('span.pname', { text: pr.name });
      }
      const act = (fn) => (e) => { e.stopPropagation(); fn(); };
      const row = h('div.profile', { class: isActive ? 'active' : null, tip: isActive ? 'Active profile' : 'Click to switch to this profile' },
        name,
        h('button.icon-btn', { tip: 'Rename', onclick: act(() => { view.renamingProfile = pr.id; App.renderPanel(false); }) }, icon('mdi_rename.png')),
        h('button.icon-btn', { tip: 'Duplicate', onclick: act(() => window.lostlite.profile('create', `${pr.name} copy`, pr.id)) }, icon('mdi_content-duplicate.png')),
        isActive || list.length <= 1 ? null : h('button.icon-btn', {
          tip: 'Delete',
          onclick: act(() => { if (window.confirm(`Are you sure you want to delete profile ${pr.name}?`)) window.lostlite.profile('delete', pr.id); }),
        }, icon('mdi_delete.png')));
      if (!isActive) row.addEventListener('click', () => window.lostlite.profile('switch', pr.id));
      return row;
    });
    return h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' },
      h('div.rl-scroll', {},
        h('div.rl-main', {},
          h('div.profile-head', { text: 'Profiles' }),
          ...rows,
          h('button.btn.block', { onclick: () => window.lostlite.profile('create', 'New profile') }, 'New Profile'))));
  }

  // RuneLite's ConfigPlugin.onOverlayMenuClicked: an overlay's "Configure" (RUNELITE_OVERLAY_CONFIG) opens its plugin's config
  window.addEventListener('lostlite-open-config', (e) => {
    const id = e.detail && e.detail.id;
    if (!id || !plugins().some((x) => x.id === id)) return;
    view.editing = id;
    if (App.activeId !== 'config') App.select('config'); else App.renderPanel(true);
  });

  window.Panels.push({
    id: 'config',
    tooltip: 'Configuration',
    icon: 'config_icon.png',
    priority: 0,
    fill: true,
    watch: ['plugins', 'profiles', 'config'],
    render(root, opts) {
      if (!opts.fresh && opts.changed.every((k) => k.startsWith('config'))) {
        // Only setting changes that affect the list itself (pins, on/off) redraw it, so
        // typing in the settings editor never rebuilds the panel.
        const relevant = opts.changed.some((k) => k === 'config:lostlite.pinnedPlugins' || /^config:lostlite\..+Plugin$/.test(k));
        // Item lists can also change from the game (Ground Items' Alt + click).
        const listChanged = view.editing && view.tab !== 'profiles' && opts.changed.some((k) => listKeys(view.editing).includes(k));
        if (listChanged) {
          render(root, opts);
          return;
        }
        if (!relevant || view.editing || view.tab === 'profiles') return;
      }
      render(root, opts);
    },
  });
})();
