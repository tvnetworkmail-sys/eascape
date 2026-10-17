'use strict';
// Port of RuneLite's configuration UI:
//   TopLevelConfigPanel  - tab group (Configuration, Profiles)
//   PluginListPanel      - search bar, pinned plugins first, star / gear / switch per row
//   ConfigPanel          - back button, title, switch, collapsible sections, one control
//                          per @ConfigItem type, and Reset
//   ProfilePanel         - list of profiles with switch, rename, duplicate, delete
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

  function matches(p, q) {
    if (!q) return true;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = [p.name, p.description, ...(p.tags || [])].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }

  // ---------------------------------------------------------------- top level

  function render(root, { fresh, changed }) {
    const tabs = h('div.mtabs', {},
      h('button.mtab', { class: view.tab === 'plugins' ? 'mtab selected' : 'mtab', tip: 'Configuration', onclick: () => { view.tab = 'plugins'; App.renderPanel(true); } }, icon('config_icon_lg.png')),
      h('button.mtab', { class: view.tab === 'profiles' ? 'mtab selected' : 'mtab', tip: 'Profiles', onclick: () => { view.tab = 'profiles'; view.editing = null; App.renderPanel(true); } }, icon('profile_icon.png')));
    let body;
    if (view.tab === 'profiles') body = profilePanel();
    else if (view.editing) body = configPanel(view.editing);
    else body = pluginList(root);
    root.replaceChildren(tabs, body);
    if (view.tab === 'plugins' && !view.editing && fresh) {
      const input = root.querySelector('.text-field input');
      if (input) input.focus();
    }
  }

  // ---------------------------------------------------------------- plugin list

  function pluginList() {
    const list = h('div.plugin-list');
    const search = UI.searchField(view.search, (q) => {
      view.search = q;
      fill();
    });
    function fill() {
      const pins = pinned();
      const all = plugins().slice().sort((a, b) => {
        // The client's own settings entry always comes first, then pinned, then by name.
        if (a.alwaysOn !== b.alwaysOn) return a.alwaysOn ? -1 : 1;
        const pa = pins.includes(a.id);
        const pb = pins.includes(b.id);
        if (pa !== pb) return pa ? -1 : 1;
        return a.name.localeCompare(b.name);
      }).filter((p) => matches(p, view.search));
      list.replaceChildren(...(all.length ? all.map((p) => pluginItem(p, pins.includes(p.id))) : [h('div.empty', { text: 'No plugins match your search.' })]));
    }
    fill();
    return h('div', {}, h('div', { style: 'padding:10px 10px 0' }, search), list);
  }

  function pluginItem(p, isPinned) {
    const pin = h('button.icon-btn.pin', { tip: isPinned ? 'Unpin plugin' : 'Pin plugin', onclick: () => { setPinned(p.id, !isPinned); App.renderPanel(false); } },
      icon(isPinned ? 'star_on.png' : 'star_off.png'));
    const name = h('span.name', p.notChecked
      ? { text: p.name, style: 'opacity:0.45', tip: `${p.name}:\n${p.description}\n\nNot checked for 2006 yet, so it stays off for now.` }
      : { text: p.name, tip: `${p.name}:\n${p.description}` });
    const row = h('div.plugin-item', {}, pin, name);
    row.addEventListener('contextmenu', (e) => UI.popup(e, [
      ['Configure', () => openConfig(p.id)],
      [isPinned ? 'Unpin' : 'Pin', () => { setPinned(p.id, !isPinned); App.renderPanel(false); }],
    ]));
    if (p.config && p.config.items.length) {
      row.append(h('button.icon-btn.cfg', { tip: 'Edit plugin configuration', onclick: () => openConfig(p.id) }, icon('config_edit_icon.png')));
    } else {
      row.append(h('span.cfg'));
    }
    if (p.alwaysOn || p.notChecked) row.append(h('span.toggle'));
    else row.append(UI.toggle(p.enabled, (on) => { setEnabled(p.id, on); App.renderPanel(false); }, p.enabled ? 'Disable plugin' : 'Enable plugin'));
    return row;
  }

  function openConfig(id) {
    view.editing = id;
    App.renderPanel(true);
  }

  // ---------------------------------------------------------------- config editor

  function configPanel(id) {
    const p = plugins().find((x) => x.id === id);
    if (!p) {
      view.editing = null;
      return pluginList();
    }
    const top = h('div.config-top', {},
      h('button.icon-btn.back', { tip: 'Back', onclick: () => { view.editing = null; App.renderPanel(true); } }, icon('config_back_icon.png')),
      h('span.title', { text: p.name, tip: p.description }),
      p.alwaysOn || p.notChecked ? null : UI.toggle(p.enabled, (on) => { setEnabled(id, on); App.renderPanel(false); }, p.enabled ? 'Disable plugin' : 'Enable plugin'));

    const main = h('div.config-main');
    const cfg = p.config;
    const sections = (cfg.sections || []).slice().sort((a, b) => a.position - b.position);
    const items = cfg.items.slice().sort((a, b) => a.position - b.position);
    // Like RuneLite's ConfigPanel: sections and loose items sorted together by position,
    // then name.
    const entries = items.filter((i) => !i.section).map((it) => ({ position: it.position, name: it.name, el: () => configItem(cfg.group, it) }));
    for (const s of sections) entries.push({ position: s.position, name: s.name, el: () => sectionEl(s) });
    entries.sort((a, b) => a.position - b.position || String(a.name).localeCompare(String(b.name)));
    function sectionEl(s) {
      const key = `${id}.${s.key}`;
      const open = view.openSections[key] !== undefined ? view.openSections[key] : !s.closedByDefault;
      const body = h('div.cfg-section-body', {}, ...items.filter((i) => i.section === s.key).map((it) => configItem(cfg.group, it)));
      const sec = h('div.cfg-section', { class: open ? 'cfg-section' : 'cfg-section closed' },
        h('div.cfg-section-header', {
          tip: s.description,
          onclick: () => {
            view.openSections[key] = sec.classList.contains('closed');
            sec.classList.toggle('closed');
          },
        }, h('span.arrow', {}, icon('arrow_right.png', { style: 'width:12px;height:12px' })), h('span.sname', { text: s.name })),
        body);
      return sec;
    }
    for (const t of entries) main.append(t.el());
    main.append(h('button.btn.block.cfg-reset', {
      onclick: () => {
        for (const it of cfg.items) {
          App.setConfig(cfg.group, it.key, undefined);
          window.lostlite.unsetConfig(cfg.group, it.key);
        }
        App.renderPanel(false);
      },
    }, 'Reset'));
    return h('div', {}, top, main);
  }

  /** 'config:group.key' names of a plugin's item lists. */
  function listKeys(id) {
    const p = (App.state.plugins || []).find((x) => x.id === id);
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
      case 'int': control = UI.spinner(Number(value), it, set); break;
      case 'enum': control = UI.combo(value, it.options, set); break;
      case 'color': control = UI.colorButton(value, set); break;
      case 'hotkey': control = UI.hotkeyButton(value, set); break;
      case 'itemlist': {
        // A comma-separated list shown one entry per row, each with a remove button, plus an
        // add box and Clear. (RuneLite only has a text box for these.)
        stack = true;
        const parse = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
        const items = parse(value);
        // Always start from the saved list, which the game may have changed since this drew.
        const current = () => parse(App.config(group, it.key, it.default));
        const save = (list) => { set(list.join(', ')); App.renderPanel(false); };
        const rows = items.map((name, i) => h('div.list-row', {},
          h('span.list-name', { text: name }),
          h('button.list-remove', { tip: `Remove ${name}`, 'aria-label': `Remove ${name}`, onclick: () => save(current().filter((x) => x.toLowerCase() !== name.toLowerCase())) }, '\u00d7')));
        const input = h('input.list-add', { type: 'text', placeholder: 'Add item...', spellcheck: 'false' });
        const add = () => {
          const v = input.value.trim();
          const now = current();
          const add2 = parse(v).filter((x) => !now.some((y) => y.toLowerCase() === x.toLowerCase()));
          if (add2.length) save(now.concat(add2));
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
        control = h('div.list-box', {},
          rows.length ? h('div.list-rows', {}, ...rows) : h('div.small.muted.list-empty', { text: 'Empty' }),
          h('div.list-controls', {}, input,
            h('button.btn.list-btn', { onclick: add }, 'Add'),
            items.length ? h('button.btn.list-btn', { onclick: () => save([]) }, 'Clear') : null));
        break;
      }
      case 'order': {
        // The sidebar's icons, top to bottom, each with up / down arrows, and Reset for the
        // usual order. (A plugin switched on later goes at the bottom until you move it.)
        // LostLite's own: RuneLite orders its sidebar by a fixed priority.
        stack = true;
        const all = App.panels();
        // (a 'sidebar-order' change redraws the open settings editor, keeping its scroll position)
        const save = (ids) => { set(ids.join(',')); App.buildTabs(); App.renderPanel(false, ['sidebar-order']); };
        const ids = all.map((p) => p.id);
        const move = (i, d) => {
          const j = i + d;
          if (j < 0 || j >= ids.length) return;
          const next = ids.slice();
          [next[i], next[j]] = [next[j], next[i]];
          save(next);
        };
        const rows = all.map((p, i) => h('div.list-row.order-row', {},
          UI.icon(p.icon, { class: 'order-icon' }),
          h('span.list-name', { text: p.tooltip }),
          h('button.list-remove', { tip: 'Move up', 'aria-label': `Move ${p.tooltip} up`, disabled: i === 0 ? '' : null, onclick: () => move(i, -1) }, '\u25b2'),
          h('button.list-remove', { tip: 'Move down', 'aria-label': `Move ${p.tooltip} down`, disabled: i === all.length - 1 ? '' : null, onclick: () => move(i, 1) }, '\u25bc')));
        control = h('div.list-box', {},
          h('div.list-rows.order', {}, ...rows),
          h('div.list-controls', {}, h('button.btn.list-btn', { onclick: () => { set(''); App.buildTabs(); App.renderPanel(false, ['sidebar-order']); } }, 'Reset')));
        break;
      }
      case 'string': {
        stack = true;
        control = h('textarea.cfg-text', { rows: '2', spellcheck: 'false' });
        control.value = value || '';
        control.addEventListener('change', () => set(control.value));
        break;
      }
      default: control = h('span.muted', { text: String(value) });
    }
    const label = h('span.label', { text: it.name, tip: it.description });
    return h('div.cfg-item', { class: stack ? 'cfg-item stack' : 'cfg-item' }, label, control);
  }

  // other panels (Info Boxes) draw settings the same way
  window.ConfigUI = { item: configItem };

  // ---------------------------------------------------------------- profiles

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
      const row = h('div.profile', { class: isActive ? 'profile active' : 'profile', tip: isActive ? 'Active profile' : 'Click to switch to this profile' },
        name,
        isActive ? h('span.small.tag', { text: 'active' }) : null,
        h('button.icon-btn', { tip: 'Rename', onclick: act(() => { view.renamingProfile = pr.id; App.renderPanel(false); }) }, icon('mdi_rename.png')),
        h('button.icon-btn', { tip: 'Duplicate', onclick: act(() => window.lostlite.profile('create', `${pr.name} copy`, pr.id)) }, icon('mdi_content-duplicate.png')),
        isActive || list.length <= 1 ? null : h('button.icon-btn', {
          tip: 'Delete',
          onclick: act(() => { if (window.confirm(`Delete the profile "${pr.name}"? This can't be undone.`)) window.lostlite.profile('delete', pr.id); }),
        }, icon('mdi_delete.png')));
      if (!isActive) row.addEventListener('click', () => window.lostlite.profile('switch', pr.id));
      return row;
    });
    return h('div', {},
      h('div.pad', { style: 'padding-bottom:0' },
        h('div.muted.small', { text: 'Profiles keep separate sets of plugin settings. Switching applies the whole set straight away.' }),
        h('button.btn.block', { style: 'margin-top:8px', onclick: () => window.lostlite.profile('create', 'New profile') }, 'New profile')),
      h('div.profile-list', {}, ...rows));
  }

  window.Panels.push({
    id: 'config',
    tooltip: 'Configuration',
    icon: 'config_icon.png',
    priority: 0,
    watch: ['plugins', 'profiles', 'config'],
    render(root, opts) {
      if (!opts.fresh && opts.changed.every((k) => k.startsWith('config'))) {
        // Only setting changes that affect the list itself (pins, on/off) redraw it, so
        // typing in the settings editor or scrolling to zoom never rebuilds the panel.
        const relevant = opts.changed.some((k) => k === 'config:lostlite.pinnedPlugins' || /^config:lostlite\..+Plugin$/.test(k));
        // Item lists can also change from the game (Ground Items' Alt + click), so redraw the
        // settings editor when one of its lists changes.
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
