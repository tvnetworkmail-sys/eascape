'use strict';
// Market panel (ours): the website's market (2006rs.com/market) in the sidebar, with everything the
// website's market pages do, so no new window:
//  - Browse: Selling, Buying, Sales and Favourites tabs like the website's, with a search box
//  - an item: its offers, its prices (Gen. store ~40%, high alch 60%, low alch 40% of its value,
//    as the website shows them), Recently sold, and Favourite
//  - Your items: your inventory, or your bank as it was when you last opened it in the game
//    (the game only sends the bank while it's open), with the offers for each; "Has buyers" shows
//    the ones somebody is buying
//  - Post an offer (up to 3 offers of up to 28 items, and notes), and edit one
//  - My offers: Active, Paused and Expired, with Bump, Edit, Pause, Unpause, Mark sold and Remove,
//    and Bump all, Pause all and Unpause all
// Logging in uses your game account on the website's own login (main.js 'market-login'); only the
// website's session is kept, never your password. The public lists come from the website's JSON API;
// your own offers and every change go through the website's own market pages and forms (main.js
// 'market-page'), read here with DOMParser and shown with our own elements (nothing from the website
// is put in as HTML). The website's rules apply as it has them: 12 offers of each kind, an offer
// shows for 24 hours, a bump every 30 minutes, expired offers stay a week.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const ICONS = 'https://2006rs.com/img/market-items';
  const COINS = 995;
  const COIN_ICONS = [1, 2, 3, 4, 5, 25, 100, 250, 1000, 10000]; // the website's coin pile icons
  const REFRESH_MS = 60 * 1000;
  const ACTIVE_MS = 24 * 60 * 60 * 1000;
  const BUMP_MS = 30 * 60 * 1000;
  const MAX_OFFERS = 3;
  const MAX_OFFER_ITEMS = 28;
  // the website's messages (webpages.ts MARKET_MESSAGES and MARKET_ERRORS), by the key it sends back
  const DONE = {
    created: 'Your offer is up. It shows for 24 hours.', updated: 'The offer has been updated.', removed: 'The offer has been removed.',
    bumped: 'Offer bumped.', bumpedall: 'Offers bumped.', paused: 'Offer paused.', pausedall: 'Offers paused.',
    unpaused: 'Offer unpaused.', unpausedall: 'Offers unpaused.', sold: 'Marked as sold.',
    favadded: 'Added to your favourites.', favremoved: 'Taken off your favourites.',
  };
  const ERR = {
    bumpwait: 'You can only bump an offer every 30 minutes.', nobump: 'No offers were found to bump.',
    nopause: 'No offers were found to pause.', nounpause: 'No offers were found to unpause.',
    notpaused: 'That offer is not paused.', alreadypaused: 'That offer is already paused.',
    favlimit: 'You have too many favourites.', muted: 'Your account is muted, so you cannot post on the market.',
  };

  // ------------------------------------------------------------------ state

  const S = {
    nav: [{ screen: 'browse' }],
    tab: 'sell', // browse: sell, buy, sales, favorites
    q: '',
    lists: { buy: null, sell: null }, // the JSON API's active listings
    loadedAt: { buy: 0, sell: 0 },
    failed: false,
    pages: {}, // parsed website pages by path: { rows, at }
    session: { loggedIn: false, name: '', csrf: '' },
    flash: null, // { ok, text }
    busy: false,
    items: new Map(), // market items by id (name, slug, cost) or null (not on the market)
  };
  try {
    const t = localStorage.getItem('market.type');
    if (t === 'buy' || t === 'sell') S.tab = t;
  } catch { /* no storage */ }
  let rootEl = null;
  let timer = null;
  const cur = () => S.nav[S.nav.length - 1];
  const put = (root, ...els) => root.append(...els.filter((e) => e !== null && e !== undefined && e !== false));

  // ------------------------------------------------------------------ formats (the website's own)

  function gold(v) {
    const n = (x) => Number(x.toFixed(2)).toLocaleString('en-US');
    v = Number(v) || 0;
    if (v >= 1000000) return `${n(v / 1000000)}M`;
    if (v >= 1000) return `${n(v / 1000)}K`;
    return v.toLocaleString('en-US');
  }
  const num = (v) => Number(v || 0).toLocaleString('en-US');
  const dbDate = (v) => new Date(String(v).includes('T') ? v : `${String(v).replace(' UTC', '').replace(' ', 'T')}Z`);
  function ago(when) {
    const s = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 1000));
    if (s < 45) return 'few secs';
    if (s < 90) return '1 min';
    const m = Math.round(s / 60);
    if (m < 45) return `${m} mins`;
    if (m < 90) return '1 hr';
    const hr = Math.round(m / 60);
    if (hr < 22) return `${hr} hrs`;
    if (hr < 36) return '1 day';
    return `${Math.round(hr / 24)} days`;
  }
  function span(ms) {
    const m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return `${m} min${m === 1 ? '' : 's'}`;
    const hr = Math.round(m / 60);
    return `${hr} hr${hr === 1 ? '' : 's'}`;
  }
  // "2.5k" style amounts, as the website reads them (parseMarketAmount)
  function amount(text, whole) {
    const m = String(text || '').trim().toLowerCase().replace(/,/g, '').match(/^([0-9]*\.?[0-9]+)\s*([kmb])?$/);
    if (!m) return null;
    const v = parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
    if (whole) return Math.floor(v) >= 1 && Math.floor(v) <= 2147483647 ? Math.floor(v) : null;
    const r = Math.round(v * 100) / 100;
    return r >= 0.01 && r <= 2147483647 ? r : null;
  }

  function iconUrl(id, qty) {
    if (id === COINS && qty !== undefined) return `${ICONS}/${COINS}_${COIN_ICONS.filter((d) => d <= qty).pop() || 1}.png`;
    return `${ICONS}/${id}.png`;
  }
  function img(id, qty, size) {
    const el = h('img', { src: iconUrl(id, qty), alt: '', style: `width:${size}px;height:${size}px;object-fit:contain;image-rendering:pixelated;flex:none` });
    el.addEventListener('error', () => { el.style.visibility = 'hidden'; });
    return el;
  }
  const btn = (text, onclick, style = '', extra = {}) => h('button.btn', { text, onclick, style: `padding:4px 6px;${style}`, ...extra });
  const act = (text, onclick, color, extra = {}) => h('button.mk-act', { text, onclick, style: color ? `color:${color}` : '', ...extra });
  const GREEN = 'rgb(90,210,90)';
  const AMBER = 'rgb(240,180,60)';
  const ROSE = 'rgb(240,120,140)';
  const RED_B = 'rgb(230,90,90)';

  // ------------------------------------------------------------------ the website

  async function loadList(type, force) {
    if (!force && S.lists[type] && Date.now() - S.loadedAt[type] < REFRESH_MS) return S.lists[type];
    const list = await window.lostlite.marketListings(type);
    S.failed = list === null;
    if (list) {
      S.lists[type] = list;
      S.loadedAt[type] = Date.now();
      for (const l of list) rememberItem(l.item);
    }
    return S.lists[type];
  }
  function rememberItem(it) {
    if (it && Number.isInteger(it.id) && it.name && !S.items.get(it.id)) S.items.set(it.id, { id: it.id, name: it.name, slug: it.slug, cost: it.cost });
  }
  async function itemsFor(ids) {
    const want = ids.filter((id) => !S.items.has(id) || (S.items.get(id) && S.items.get(id).cost === undefined));
    if (want.length) {
      const got = await window.lostlite.marketItems(want);
      for (const [id, v] of Object.entries(got || {})) S.items.set(Number(id), v);
    }
    return S.items;
  }

  const doc = (html) => new DOMParser().parseFromString(html || '', 'text/html');

  /** A website page: { doc, status } after noting whether you're logged in and the page's csrf.
   *  null when the website couldn't be reached; { login: true } when it wants you to log in. */
  async function page(path) {
    const r = await window.lostlite.marketPage(path);
    if (!r) return null;
    if (r.location) {
      if (/^\/login\b/.test(r.location)) {
        S.session = { loggedIn: false, name: '', csrf: '' };
        return { login: true };
      }
      return page(r.location.replace(/^https?:\/\/[^/]+/, ''));
    }
    const d = doc(r.html);
    readSession(d);
    return { doc: d, status: r.status };
  }
  function readSession(d) {
    const csrf = d.querySelector('input[name=csrf]');
    const logout = d.querySelector('form[action="/logout"]');
    if (logout) {
      const who = d.querySelector('details summary.mk-btn-2');
      S.session.loggedIn = true;
      if (who) S.session.name = who.textContent.replace(/[▾▼]/g, '').trim();
      if (csrf && csrf.value) S.session.csrf = csrf.value;
    } else if (d.querySelector('.mk-tabs, .mk-listhead, .mk-itemhead')) {
      S.session = { loggedIn: false, name: '', csrf: '' };
    }
  }
  async function csrf() {
    if (!S.session.csrf) await page('/market/listings');
    return S.session.csrf;
  }

  /** Sends one of the website's market forms. Resolves { ok, text, location } from where the
   *  website sends you after (?done= or ?err=), or the error it shows on the form. */
  async function send(path, fields) {
    const token = await csrf();
    if (!token) return { ok: false, text: 'Please log in again.', login: !S.session.loggedIn };
    const r = await window.lostlite.marketPage(path, { csrf: token, back: '/market/listings', ...fields });
    if (!r) return { ok: false, text: "Couldn't reach the market." };
    S.pages = {};
    S.loadedAt = { buy: 0, sell: 0 };
    if (r.location) {
      if (/^\/login\b/.test(r.location)) {
        S.session = { loggedIn: false, name: '', csrf: '' };
        return { ok: false, text: 'Please log in again.', login: true };
      }
      const u = new URL(r.location, 'https://x');
      const err = u.searchParams.get('err');
      const done = u.searchParams.get('done');
      if (err) return { ok: false, text: ERR[err] || 'That did not work.' };
      return { ok: true, text: DONE[done] || '', location: u.pathname + u.search };
    }
    const d = doc(r.html);
    readSession(d);
    const e = d.querySelector('.mk-err, .mk-flash-err');
    if (e) return { ok: false, text: e.textContent.trim() };
    if (r.status === 403) {
      S.session.csrf = '';
      return { ok: false, text: 'The page was out of date. Please try again.' };
    }
    return { ok: r.status < 400, text: r.status < 400 ? '' : `The website said ${r.status}.` };
  }

  const idOf = (src) => {
    const m = /market-items\/(\d+)(?:_\d+)?\.png/.exec(src || '');
    return m ? Number(m[1]) : -1;
  };
  const slugOf = (href) => {
    const m = /\/market\/items\/([^?#/]+)/.exec(href || '');
    return m ? decodeURIComponent(m[1]) : '';
  };
  const qtyOf = (t) => Number(String(t || '').replace(/,/g, '')) || 0;

  /** The website's listing rows (_rows.ejs) in one table, as plain data. */
  function rows(table, item) {
    const out = [];
    if (!table) return out;
    for (const tr of table.querySelectorAll('tr')) {
      const price = tr.querySelector('td.mk-price');
      if (!price) continue;
      const a = tr.querySelector('td.mk-itemcell a');
      const it = a ? { id: idOf(a.querySelector('img') && a.querySelector('img').getAttribute('src')), slug: slugOf(a.getAttribute('href')), name: a.getAttribute('title') || '' } : item;
      const offers = [...price.querySelectorAll('.mk-offerpanel')].map((p) => ({
        title: (p.querySelector('p') || {}).textContent || 'For each item:',
        items: [...p.querySelectorAll('a.mk-single')].map((x) => {
          const b = x.querySelector('b');
          return { itemId: idOf(x.querySelector('img') && x.querySelector('img').getAttribute('src')), slug: slugOf(x.getAttribute('href')), name: x.getAttribute('title') || '', quantity: qtyOf(b && b.getAttribute('title')) };
        }),
      }));
      const qty = price.querySelector(':scope > span[title]');
      const time = tr.querySelector('td.mk-time span');
      const notes = tr.querySelector('td.mk-notes span');
      const user = tr.querySelector('td.mk-user a');
      const acts = tr.querySelector('td.mk-actions');
      let id = 0;
      const can = {};
      if (acts) {
        for (const f of acts.querySelectorAll('form')) {
          const m = /\/market\/listings\/(\d+)\/(\w+)/.exec(f.getAttribute('action') || '');
          if (m) { id = Number(m[1]); can[m[2]] = true; }
        }
        for (const l of acts.querySelectorAll('a')) {
          const m = /\/market\/listings\/(\d+)\/(\w+)/.exec(l.getAttribute('href') || '');
          if (m) { id = Number(m[1]); can[m[2]] = true; }
        }
      }
      if (it) rememberItem(it);
      out.push({
        id,
        can,
        sold: tr.classList.contains('mk-sold'),
        type: price.querySelector('.mk-b') ? 'buy' : 'sell',
        item: it || { id: -1, slug: '', name: '' },
        quantity: qtyOf(qty && qty.getAttribute('title')),
        offers,
        username: user ? user.textContent.trim() : '',
        when: time ? dbDate(time.getAttribute('title')) : null,
        notes: notes ? notes.getAttribute('title') || '' : '',
      });
    }
    return out;
  }

  // the coins asked or offered for each item, when an offer is only coins
  const coinPrice = (l) => {
    const p = (l.offers || []).filter((o) => o.items.length === 1 && o.items[0].itemId === COINS).map((o) => o.items[0].quantity);
    return p.length ? p : null;
  };
  // the JSON API's listings in the same shape as the website's rows
  const apiRow = (l) => ({
    id: l.id, can: {}, sold: !!l.soldAt, type: l.type, item: l.item, quantity: l.quantity, username: l.username,
    when: new Date(l.updatedAt), notes: l.notes || '', offers: l.offers || [],
  });

  // ------------------------------------------------------------------ shared pieces

  function go(screen, args = {}) {
    S.nav.push({ screen, ...args });
    S.flash = null;
    render();
  }
  function back() {
    if (S.nav.length > 1) S.nav.pop();
    S.flash = null;
    render();
  }
  function home(flash) {
    S.nav = [{ screen: 'browse' }];
    S.flash = flash || null;
    render();
  }
  const backBtn = () => h('button.btn.small', { style: 'align-self:flex-start;padding:2px 8px', text: '‹ Back', onclick: back });
  const flashEl = () => (S.flash ? h('div.small', { style: `padding:4px 6px;border:1px solid var(--border);background:var(--darker-gray);color:${S.flash.ok ? GREEN : RED_B}`, text: S.flash.text }) : document.createComment('no message'));
  const muted = (text, style = '') => h('div.small.muted', { text, style });
  const tabs = (list, on, pick) => h('div', { style: `display:grid;grid-template-columns:repeat(${list.length},minmax(0,1fr));gap:2px` },
    ...list.map(([k, text]) => h('button.btn.small', {
      text,
      style: `padding:4px 0;${on === k ? 'background:var(--darker-gray-hover);color:#fff;border-bottom:2px solid var(--brand-orange)' : ''}`,
      onclick: () => pick(k),
    })));

  /** The offer's items, small: "for [coins] 25K ea." */
  function offerLine(l, max = 3) {
    const all = (l.offers || []).flatMap((o) => o.items || []);
    const shown = all.slice(0, max);
    const each = (l.offers || []).length === 1 && l.quantity !== 1 && all.length <= max;
    return h('div.small', { style: 'display:flex;align-items:center;gap:3px;flex-wrap:wrap' },
      shown.length ? h('span.muted', { text: 'for' }) : null,
      ...shown.map((i) => h('span', { style: 'display:inline-flex;align-items:center;gap:1px' }, img(i.itemId, i.quantity, 18), h('span', { text: gold(i.quantity) }))),
      all.length > shown.length ? h('span.muted', { text: `+${all.length - shown.length}` }) : null,
      each ? h('span.muted', { text: 'ea.' }) : null,
      (l.offers || []).length > 1 ? h('span.muted', { text: `(${l.offers.length} offers)` }) : null);
  }
  function offerTip(l) {
    return [`${l.type === 'buy' ? 'Buying' : 'Selling'} ${num(l.quantity)} x ${l.item.name}`]
      .concat((l.offers || []).map((o, i) => `${i ? 'or ' : ''}${o.title}\n${(o.items || []).map((x) => `  ${num(x.quantity)} ${x.name}`).join('\n')}`))
      .concat(l.notes ? [`"${l.notes}"`] : [])
      .concat(l.username ? [`${l.username}${l.when ? `, ${ago(l.when)} ago` : ''}`] : [])
      .join('\n');
  }

  /** A listing in a list: item, how many, for what, who, how long ago. */
  function listingRow(l, opts = {}) {
    const el = h('div.mk-row', { tip: offerTip(l) },
      opts.noItem ? null : img(l.item.id, undefined, 32),
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' },
          h('span', { text: `[${l.type === 'buy' ? 'B' : 'S'}] `, style: `color:${l.type === 'buy' ? RED_B : GREEN}` }),
          h('span.white', { text: opts.noItem ? gold(l.quantity) : `${gold(l.quantity)} ${l.item.name}` })),
        offerLine(l),
        h('div.small.muted', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: [l.username, l.when ? ago(l.when) : '', l.notes].filter(Boolean).join(' · ') })));
    if (!opts.noItem && l.item.slug) el.addEventListener('click', () => go('item', { item: l.item, type: l.type }));
    else el.style.cursor = 'default';
    return el;
  }

  /** An item search box with a drop-down of the market's items (the website's item search). */
  function itemPicker(placeholder, onpick) {
    const drop = h('div.mk-drop');
    drop.hidden = true;
    let seq = 0;
    const field = UI.searchField('', async (q) => {
      const n = ++seq;
      if (q.trim().length < 2) { drop.hidden = true; return; }
      const list = await window.lostlite.marketSearch(q);
      if (n !== seq) return;
      drop.replaceChildren(...(list && list.length ? list.map((it) => {
        rememberItem(it);
        return h('div.mk-dropitem', { onclick: () => { drop.hidden = true; field.input.value = ''; onpick(it); } }, img(it.id, undefined, 20), h('span', { text: it.name }));
      }) : [muted(list === null ? "Couldn't reach the market." : 'No items found.', 'padding:4px 6px')]));
      drop.hidden = false;
    }, placeholder);
    return h('div', { style: 'position:relative' }, field, drop);
  }

  // ------------------------------------------------------------------ screens

  function loginScreen(root) {
    const then = cur().then;
    const user = h('input.mk-in', { type: 'text', maxlength: '12', autocomplete: 'username', spellcheck: 'false' });
    const pass = h('input.mk-in', { type: 'password', maxlength: '20', autocomplete: 'current-password' });
    let keep = true;
    try { keep = localStorage.getItem('market.keep') !== '0'; } catch { /* no storage */ }
    const box = UI.checkbox(keep, (v) => { keep = v; try { localStorage.setItem('market.keep', v ? '1' : '0'); } catch { /* no storage */ } });
    const err = h('div.small', { style: `color:${RED_B}` });
    const go2 = h('button.btn.bold', { text: 'Log in', style: 'background:rgb(30,100,40);padding:7px' });
    const submit = async () => {
      if (!user.value.trim() || !pass.value) { err.textContent = 'Enter your username and password.'; return; }
      go2.disabled = true;
      err.textContent = '';
      const r = await window.lostlite.marketLogin(user.value.trim(), pass.value, keep);
      pass.value = '';
      go2.disabled = false;
      if (!r || !r.ok) { err.textContent = (r && r.error) || 'That did not work.'; return; }
      S.session = { loggedIn: true, name: user.value.trim(), csrf: '' };
      S.pages = {};
      await page('/market/listings');
      S.nav.pop();
      if (then) S.nav.push(then);
      render();
    };
    go2.addEventListener('click', submit);
    for (const i of [user, pass]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    put(root, 
      backBtn(),
      h('div.bold', { style: 'color:var(--brand-orange)', text: 'Log in to the market' }),
      muted('Use your game account. Your password goes only to 2006rs.com and is never saved.'),
      h('label', { style: 'display:flex;flex-direction:column;gap:3px' }, h('span', { text: 'Username' }), user),
      h('label', { style: 'display:flex;flex-direction:column;gap:3px' }, h('span', { text: 'Password' }), pass),
      h('div', { style: 'display:flex;align-items:center;gap:6px' }, box, h('span.small', { text: 'Keep me logged in' })),
      err,
      go2);
    setTimeout(() => user.focus(), 0);
  }

  function needLogin(then) {
    S.nav.push({ screen: 'login', then });
    render();
  }

  function sessionBar() {
    if (S.session.loggedIn) {
      return h('div.small', { style: 'display:flex;align-items:center;gap:4px' },
        h('span.muted', { text: 'Logged in as' }), h('span.white', { text: S.session.name || 'you', style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis' }),
        h('a.small', { href: '#', text: 'Log out', onclick: async (e) => {
          e.preventDefault();
          await window.lostlite.marketLogout(S.session.csrf);
          S.session = { loggedIn: false, name: '', csrf: '' };
          S.pages = {};
          home({ ok: true, text: 'Logged out of the market.' });
        } }));
    }
    return h('div.small', { style: 'display:flex;align-items:center;gap:4px' },
      h('span.muted', { text: 'Not logged in', style: 'flex:1' }),
      h('a.small', { href: '#', text: 'Log in', onclick: (e) => { e.preventDefault(); needLogin(null); } }));
  }

  function browseScreen(root) {
    const listEl = h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, muted('Loading...', 'padding:8px 0'));
    const search = UI.searchField(S.q, (q) => { S.q = q || ''; fill(); }, 'Search an item');
    let shown = null;
    const fill = () => {
      if (cur().screen !== 'browse') return;
      if (shown === null) {
        listEl.replaceChildren(muted(S.failed ? "Couldn't reach the market." : 'Loading...', 'padding:8px 0'));
        return;
      }
      if (shown.login) {
        listEl.replaceChildren(muted('Log in to see your favourites.', 'padding:8px 0'), btn('Log in', () => needLogin(null)));
        return;
      }
      const q = S.q.trim().toLowerCase();
      const hits = q ? shown.filter((l) => l.item.name.toLowerCase().includes(q) || l.offers.some((o) => o.items.some((i) => i.name.toLowerCase().includes(q)))) : shown;
      const none = { sell: 'Nobody is selling anything right now.', buy: 'Nobody is buying anything right now.', sales: 'No sales in the last day.', favorites: 'No offers for your favourite items. Add favourites from an item.' }[S.tab];
      listEl.replaceChildren(...(hits.length ? hits.map((l) => listingRow(l)) : [muted(q ? 'No offers match.' : none, 'padding:8px 0')]));
    };
    const load = async (force) => {
      const tab = S.tab;
      if (tab === 'buy' || tab === 'sell') {
        const list = await loadList(tab, force);
        if (S.tab === tab) shown = list ? list.map(apiRow) : null;
      } else {
        const path = tab === 'sales' ? '/market/sales' : '/market?tab=favorites&type=all';
        const p = force || !S.pages[path] ? await page(path) : S.pages[path];
        if (p && p.doc) S.pages[path] = p;
        if (S.tab === tab) shown = !p ? null : p.login || (p.doc && p.doc.querySelector('.mk-hint') && !S.session.loggedIn) ? { login: true } : rows(p.doc.querySelector('#mk-live table'));
      }
      fill();
    };
    put(root, 
      sessionBar(),
      flashEl(),
      tabs([['sell', 'Selling'], ['buy', 'Buying'], ['sales', 'Sales'], ['favorites', 'Favs']], S.tab, (k) => {
        S.tab = k;
        if (k === 'buy' || k === 'sell') try { localStorage.setItem('market.type', k); } catch { /* no storage */ }
        render();
      }),
      search,
      listEl,
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px' },
        btn('Post an offer', () => (S.session.loggedIn ? go('post', {}) : needLogin({ screen: 'post' })), 'background:rgb(30,100,40)'),
        btn('My offers', () => (S.session.loggedIn ? go('mine') : needLogin({ screen: 'mine' }))),
        btn('Your items', () => go('yours')),
        btn('Refresh', () => load(true))),
      h('a.small', { href: '#', text: 'Open the market in your browser', style: 'align-self:center', onclick: (e) => { e.preventDefault(); window.lostlite.openMarket('/market'); } }));
    load(false);
    browseScreen.reload = () => load(true);
  }

  async function itemScreen(root) {
    const v = cur();
    const it = v.item;
    const info = (await itemsFor([it.id])).get(it.id) || it;
    if (cur() !== v) return;
    const have = haveCount(it.id);
    const fav = h('button.btn.small', { style: 'padding:2px 6px', text: '...', disabled: true });
    const head = h('div', { style: 'display:flex;gap:8px;align-items:center;padding:6px;background:var(--darker-gray)' },
      img(it.id, undefined, 36),
      h('div', { style: 'flex:1;min-width:0' }, h('div.bold.white', { text: info.name || it.name }), have ? muted(have) : null),
      S.session.loggedIn ? fav : null);
    const cost = info.cost || 0;
    const prices = h('div.small', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;text-align:center' },
      ...[['Gen. store', `~${num(Math.floor(cost * 0.4))}`], ['High alch', num(Math.floor(cost * 0.6))], ['Low alch', num(Math.floor(cost * 0.4))]]
        .map(([k, x]) => h('div', { style: 'background:var(--darker-gray);padding:3px 0' }, h('div.muted', { text: k }), h('div.white', { text: info.cost === undefined ? '?' : `${x}` }))));
    const listEl = h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, muted('Loading...'));
    const soldEl = h('div', { style: 'display:flex;flex-direction:column;gap:2px' });
    const [buy, sell] = await Promise.all([loadList('buy'), loadList('sell')]);
    if (cur() !== v) return;
    const n = (list) => (list || []).filter((l) => l.item.id === it.id).length;
    put(root, 
      backBtn(), flashEl(), head, prices,
      tabs([['buy', `Buying (${n(buy)})`], ['sell', `Selling (${n(sell)})`]], v.type, (k) => { v.type = k; render(); }),
      listEl,
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px' },
        btn('Sell yours', () => post({ item: info, type: 'sell' }), 'background:rgb(30,100,40)'),
        btn('Post a buy', () => post({ item: info, type: 'buy' }))),
      h('div.bold.white', { text: 'Recently sold', style: 'padding-top:4px' }),
      soldEl);
    const slug = info.slug || it.slug;
    const p = await page(`/market/items/${encodeURIComponent(slug)}?type=${v.type}`);
    if (cur() !== v) return;
    if (!p || !p.doc) { listEl.replaceChildren(muted("Couldn't reach the market.")); return; }
    const tables = p.doc.querySelectorAll('.mk-table');
    const live = rows(p.doc.querySelector('#mk-live table'), it);
    const sold = rows(tables[tables.length - 1] && tables[tables.length - 1] !== p.doc.querySelector('#mk-live') ? tables[tables.length - 1].querySelector('table') : null, it);
    listEl.replaceChildren(...(live.length ? live.map((l) => listingRow(l, { noItem: true })) : [muted(`Nobody is ${v.type === 'buy' ? 'buying' : 'selling'} this right now.`, 'padding:4px 0')]));
    soldEl.replaceChildren(...(sold.length ? sold.slice(0, 8).map((l) => {
      const c = coinPrice(l);
      return h('div.mk-row.small', { tip: offerTip(l), style: 'cursor:default' },
        h('span', { style: 'flex:1;min-width:0', text: `${gold(l.quantity)} ${c ? `at ${gold(c[0])} ea.` : 'traded'}` }),
        h('span.muted', { text: l.when ? ago(l.when) : '' }));
    }) : [muted('No sales yet.')]));
    const f = p.doc.querySelector('.mk-itemname form');
    if (f && S.session.loggedIn) {
      const isFav = /\/delete$/.test(f.getAttribute('action') || '');
      fav.disabled = false;
      fav.textContent = isFav ? '★ Fav' : '☆ Fav';
      UI.tip(fav, isFav ? 'Take off your favourites' : 'Add to your favourites');
      fav.style.color = isFav ? AMBER : '';
      fav.addEventListener('click', async () => {
        fav.disabled = true;
        const r = await send(isFav ? `/market/favorites/${it.id}/delete` : '/market/favorites', { item_id: String(it.id), back: `/market/items/${slug}` });
        S.flash = { ok: r.ok, text: r.text || (r.ok ? 'Done.' : 'That did not work.') };
        render();
      });
    }
  }

  function post(opts) {
    if (!S.session.loggedIn) needLogin({ screen: 'post', ...opts });
    else go('post', opts);
  }

  // ---- your items

  function haveCount(id) {
    // a noted item is the next id, with the same name
    const add = (m) => {
      const a2 = m.get(id);
      const n = m.get(id + 1);
      const q = (a2 ? a2.quantity : 0) + (n && (!a2 || n.name === a2.name) && S.items.get(id) && n.name === S.items.get(id).name ? n.quantity : 0);
      return q ? { quantity: q } : null;
    };
    const inv = add(invMap());
    const bank = add(bankMap());
    const parts = [];
    if (inv) parts.push(`${num(inv.quantity)} (inventory)`);
    if (bank) parts.push(`${num(bank.quantity)} (bank)`);
    return parts.length ? `You have ${parts.join(', ')}` : '';
  }
  function invMap() {
    const m = new Map();
    const inv = (App.state.items && App.state.items.inventory) || [];
    for (const it of inv) {
      if (!it) continue;
      const o = m.get(it.id) || { id: it.id, name: it.name, quantity: 0 };
      o.quantity += it.quantity || 1;
      m.set(it.id, o);
    }
    return m;
  }
  function bankMap() {
    const m = new Map();
    const b = App.state.bank;
    for (const it of (b && b.items) || []) {
      const o = m.get(it.id) || { id: it.id, name: it.name, quantity: 0 };
      o.quantity += it.quantity;
      m.set(it.id, o);
    }
    return m;
  }

  /** Your items as the market knows them: noted items count as the item itself (the note is the
   *  next id, with the same name), and untradeable ones are left out. */
  async function marketHoldings(source) {
    const raw = [...(source === 'bank' ? bankMap() : invMap()).values()];
    const ids = raw.flatMap((r) => [r.id, r.id - 1].filter((x) => x >= 0));
    const known = await itemsFor(ids);
    const out = new Map();
    for (const r of raw) {
      let it = known.get(r.id);
      if (!it) {
        const un = known.get(r.id - 1);
        if (un && un.name.toLowerCase() === String(r.name || '').toLowerCase()) it = un;
      }
      if (!it || it.id === COINS) continue;
      const o = out.get(it.id) || { item: it, quantity: 0 };
      o.quantity += r.quantity;
      out.set(it.id, o);
    }
    return [...out.values()];
  }

  function priceInfo(id) {
    const of = (list) => (list || []).filter((l) => l.item.id === id);
    const buys = of(S.lists.buy);
    const sells = of(S.lists.sell);
    const top = Math.max(0, ...buys.flatMap((l) => coinPrice(l) || []));
    const low = sells.flatMap((l) => coinPrice(l) || []);
    return { buys, sells, top, low: low.length ? Math.min(...low) : 0 };
  }

  async function yoursScreen(root) {
    const v = cur();
    v.source = v.source || (App.state.bank && App.state.bank.items ? 'bank' : 'inventory');
    v.sort = v.sort || 'value';
    if (v.buyers === undefined) v.buyers = true;
    const listEl = h('div.mk-scroll', {}, muted('Loading...', 'padding:6px'));
    const sumEl = muted('');
    const moreEl = muted('', 'text-align:center');
    const detailEl = h('div');
    const search = UI.searchField(v.q || '', (q) => { v.q = q || ''; fill(); }, 'Search your items');
    const chip = (text, on, onclick) => h('button.btn.small', { text, onclick, style: `padding:2px 6px;${on ? 'background:var(--darker-gray-hover);color:#fff;border-bottom:2px solid var(--brand-orange)' : ''}` });
    const chipsEl = h('div', { style: 'display:flex;gap:3px;flex-wrap:wrap' });
    put(root, 
      backBtn(),
      h('div.bold.white', { text: 'What do you want to sell?' }),
      tabs([['inventory', 'Inventory'], ['bank', 'Bank']], v.source, (k) => { v.source = k; v.pick = null; render(); }),
      search, chipsEl, sumEl, listEl, moreEl, detailEl,
      muted('Untradeable items are left out.'));
    let all = [];
    const fill = () => {
      if (cur() !== v) return;
      const q = (v.q || '').trim().toLowerCase();
      const withP = all.map((x) => ({ ...x, p: priceInfo(x.item.id) }));
      const buyers = withP.filter((x) => x.p.buys.length);
      chipsEl.replaceChildren(
        chip(`Has buyers (${buyers.length})`, v.buyers, () => { v.buyers = !v.buyers; fill(); }),
        chip('Worth most', v.sort === 'value', () => { v.sort = 'value'; fill(); }),
        chip('Most of', v.sort === 'qty', () => { v.sort = 'qty'; fill(); }),
        chip('A–Z', v.sort === 'az', () => { v.sort = 'az'; fill(); }));
      let list = (v.buyers ? buyers : withP).filter((x) => !q || x.item.name.toLowerCase().includes(q));
      const worth = (x) => (v.buyers && x.p.top ? x.p.top : x.item.cost || 0) * x.quantity;
      list = list.sort(v.sort === 'qty' ? (a, b) => b.quantity - a.quantity : v.sort === 'az' ? (a, b) => a.item.name.localeCompare(b.item.name) : (a, b) => worth(b) - worth(a));
      const where = v.source === 'bank' ? 'your bank' : 'your inventory';
      const b = App.state.bank;
      const when = v.source === 'bank' && b && b.at ? ` (as of ${ago(b.at)} ago)` : '';
      if (v.source === 'inventory' && !(App.state.items && App.state.items.inventory)) {
        sumEl.textContent = 'Log in to the game to see your inventory.';
        listEl.replaceChildren(muted('No inventory.', 'padding:6px'));
        moreEl.textContent = '';
        return;
      }
      if (v.source === 'bank' && !(b && b.items)) {
        sumEl.textContent = 'Open your bank in the game once and your items show here.';
        listEl.replaceChildren(muted('No bank yet.', 'padding:6px'));
        moreEl.textContent = '';
        return;
      }
      sumEl.textContent = `${num(all.length)} market item${all.length === 1 ? '' : 's'} in ${where}${when}.${v.buyers ? ` Showing the ${num(list.length)} someone wants to buy.` : ''}`;
      listEl.replaceChildren(...(list.length ? list.map((x, i) => {
        const line = x.p.buys.length
          ? (x.p.top ? `${x.p.buys.length > 1 ? `${x.p.buys.length} buyers, up` : 'Buyer up'} to ${gold(x.p.top)} ea.` : `${x.p.buys.length} buyer${x.p.buys.length > 1 ? 's' : ''}`)
          : x.p.sells.length ? `${x.p.sells.length} selling${x.p.low ? `, from ${gold(x.p.low)} ea.` : ''}` : 'No offers';
        const on = v.pick === x.item.id;
        const el = h(on ? 'button.mk-pickrow.mk-on' : 'button.mk-pickrow', { style: `background:${on ? 'var(--darker-gray-hover)' : i % 2 ? 'var(--odd-row)' : 'var(--dark-gray)'};${on ? 'outline:2px solid var(--brand-orange);outline-offset:-2px' : ''}`, onclick: () => { v.pick = x.item.id; fill(); } },
          img(x.item.id, undefined, 28),
          h('span', { style: 'flex:1;min-width:0' }, h('span.white', { text: x.item.name, style: 'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }), h('span.small', { text: line, style: `display:block;color:${x.p.buys.length ? RED_B : 'var(--light-gray)'}` })),
          h('span.small', { text: num(x.quantity), style: 'color:rgb(255,255,0)' }));
        return el;
      }) : [muted(q ? 'Nothing matches.' : v.buyers ? 'Nobody is buying anything you have.' : 'Nothing here the market has.', 'padding:6px')]));
      moreEl.textContent = v.buyers && withP.length > buyers.length ? `${num(withP.length - buyers.length)} more with no buyers` : '';
      const picked = all.find((x) => x.item.id === v.pick);
      detailEl.replaceChildren(picked ? detail(picked) : muted('Pick an item to see its offers.'));
      const pe = listEl.querySelector('.mk-on');
      if (v.listTop !== undefined) { listEl.scrollTop = v.listTop; v.listTop = undefined; } else if (pe && v.scrollTo) pe.scrollIntoView({ block: 'nearest' });
      v.scrollTo = false;
    };
    const detail = (x) => {
      const p = priceInfo(x.item.id);
      const lastSold = h('span', { text: '...' });
      const card = h('div', { style: 'display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--darker-gray);border:1px solid var(--border)' },
        h('div', { style: 'display:flex;align-items:center;gap:8px;cursor:pointer', onclick: () => go('item', { item: x.item, type: 'buy' }), tip: "Open the item's offers" },
          img(x.item.id, undefined, 32),
          h('div', {}, h('div.bold.white', { text: x.item.name }), muted(`You have ${num(x.quantity)}`))),
        h('div.small', { style: 'display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:2px' },
          h('span.muted', { text: 'Selling now' }), h('span', { text: p.sells.length ? `${p.sells.length} offer${p.sells.length > 1 ? 's' : ''}${p.low ? `, from ${gold(p.low)} ea.` : ''}` : 'None' }),
          h('span.muted', { text: 'Buying now' }), h('span', { text: p.buys.length ? `${p.buys.length} offer${p.buys.length > 1 ? 's' : ''}${p.top ? `, up to ${gold(p.top)} ea.` : ''}` : 'None' }),
          h('span.muted', { text: 'Last sold' }), lastSold,
          h('span.muted', { text: 'High alch' }), h('span', { text: num(Math.floor((x.item.cost || 0) * 0.6)) })),
        h('button.btn.bold', { text: 'Sell these', style: 'background:rgb(30,100,40)', onclick: () => post({ item: x.item, type: 'sell', quantity: x.quantity }) }));
      v.sold = v.sold || new Map();
      const showSold = (s) => {
        const c = s && coinPrice(s);
        lastSold.textContent = s ? `${c ? `${gold(c[0])} ea.` : 'a trade'}, ${ago(s.when)} ago` : 'Not yet';
      };
      if (v.sold.has(x.item.id)) showSold(v.sold.get(x.item.id));
      else {
        page(`/market/items/${encodeURIComponent(x.item.slug)}?type=sell`).then((pg) => {
          if (!pg || !pg.doc) { lastSold.textContent = '?'; return; }
          const tables = pg.doc.querySelectorAll('.mk-table');
          const t = tables[tables.length - 1];
          const s = t && t.id !== 'mk-live' ? rows(t.querySelector('table'), x.item)[0] || null : null;
          v.sold.set(x.item.id, s);
          showSold(s);
        });
      }
      return card;
    };
    await Promise.all([loadList('buy'), loadList('sell')]);
    all = await marketHoldings(v.source);
    if (v.pick) v.scrollTo = true;
    fill();
  }

  // ---- post an offer (and edit one)

  async function postScreen(root) {
    const v = cur();
    if (!v.form) {
      v.form = { type: v.type || 'sell', item: v.item || null, quantity: v.quantity ? String(v.quantity) : '', notes: '', offers: [{ items: [{ itemId: COINS, name: 'Coins', quantity: '' }] }] };
      if (v.edit) {
        const p = await page(`/market/listings/${v.edit}/edit`);
        if (cur() !== v) return;
        if (!p || !p.doc) { put(root, backBtn(), muted("Couldn't reach the market.")); return; }
        if (p.login) { needLogin(null); return; }
        const d = p.doc;
        const sel = d.querySelector('select[name=type] option[selected]');
        const offersEl = d.querySelector('[data-offers]');
        let offers = [];
        try { offers = JSON.parse(offersEl.getAttribute('data-offers')); } catch { /* none */ }
        v.form.type = sel ? sel.value : v.form.type;
        v.form.quantity = (d.querySelector('input[name=quantity]') || {}).value || '';
        v.form.notes = (d.querySelector('input[name=notes]') || {}).value || '';
        v.form.offers = offers.length ? offers.map((o) => ({ items: o.items.map((i) => ({ itemId: i.itemId, name: i.name, quantity: String(i.quantity) })) })) : v.form.offers;
      }
    }
    const f = v.form;
    const err = h('div.small', { style: `color:${RED_B}` });
    const have = f.item ? invMap().get(f.item.id) || bankMap().get(f.item.id) : null;
    const itemBox = f.item
      ? h('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px;background:var(--darker-gray);border:1px solid var(--border)' },
        img(f.item.id, undefined, 32),
        h('div', { style: 'flex:1;min-width:0' }, h('div.white', { text: f.item.name }), f.item && haveCount(f.item.id) ? muted(haveCount(f.item.id)) : null),
        v.edit ? null : btn('Change', () => { f.item = null; render(); }, 'padding:2px 6px'))
      : itemPicker('Search for an item', (it) => { f.item = it; render(); });
    const qty = h('input.mk-in', { type: 'text', maxlength: '20', placeholder: 'Qty', style: 'flex:1' });
    qty.value = f.quantity;
    qty.addEventListener('input', () => { f.quantity = qty.value; });
    const notes = h('input.mk-in', { type: 'text', maxlength: '200', placeholder: 'Optional, ex: w1 varrock' });
    notes.value = f.notes;
    notes.addEventListener('input', () => { f.notes = notes.value; });
    const offersEl = h('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    f.offers.forEach((o, oi) => {
      const box = h('div', { style: 'display:flex;flex-direction:column;gap:4px;padding:6px;background:var(--darker-gray);border:1px solid var(--border)' },
        h('div.small.muted', { style: 'display:flex' }, h('span', { text: `Offer ${oi + 1}${oi ? ' (or)' : ''}`, style: 'flex:1' }),
          f.offers.length > 1 ? h('a.small', { href: '#', text: 'remove', onclick: (e) => { e.preventDefault(); f.offers.splice(oi, 1); render(); } }) : null));
      o.items.forEach((it, ii) => {
        const inp = h('input.mk-in', { type: 'text', maxlength: '20', style: 'width:64px', 'aria-label': `${it.name} amount` });
        inp.value = it.quantity;
        inp.addEventListener('input', () => { it.quantity = inp.value; });
        box.append(h('div', { style: 'display:flex;align-items:center;gap:4px' },
          img(it.itemId, amount(it.quantity) || 1, 20),
          h('span', { text: it.name, style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }),
          inp,
          h('span.small.muted', { text: 'ea.' }),
          o.items.length > 1 ? h('button.mk-x', { text: '×', tip: 'Take this out', onclick: () => { o.items.splice(ii, 1); render(); } }) : null));
      });
      if (o.items.length < MAX_OFFER_ITEMS) {
        const add = h('div');
        const open = btn('+ Add an item', () => {
          add.replaceChildren(itemPicker('Search for an item', (picked) => {
            if (!o.items.some((x) => x.itemId === picked.id)) o.items.push({ itemId: picked.id, name: picked.name, quantity: '' });
            render();
          }));
          const i = add.querySelector('input');
          if (i) i.focus();
        }, 'padding:2px 6px;align-self:flex-start', { class: 'btn small' });
        add.append(open);
        box.append(add);
      }
      offersEl.append(box);
    });
    const submit = h('button.btn.bold', { text: v.edit ? 'Save changes' : 'Post offer', style: 'background:rgb(30,100,40);padding:8px' });
    submit.addEventListener('click', async () => {
      if (!f.item) { err.textContent = 'Please select an item.'; return; }
      if (amount(f.quantity, true) === null) { err.textContent = 'Please enter a valid quantity (1 to 2,147,483,647).'; return; }
      for (const o of f.offers) for (const i of o.items) if (amount(i.quantity) === null) { err.textContent = `Please enter how many ${i.name} for each item.`; return; }
      submit.disabled = true;
      err.textContent = '';
      const fields = {
        type: f.type,
        item_id: String(f.item.id),
        quantity: f.quantity.trim(),
        notes: f.notes.trim(),
        offers: JSON.stringify(f.offers.map((o) => ({ title: 'For each item:', items: o.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity.trim().replace(/,/g, '') })) }))),
      };
      if (v.edit) fields.fixed_item = '1';
      const r = await send(v.edit ? `/market/listings/${v.edit}` : '/market/listings', fields);
      submit.disabled = false;
      if (r.login) { needLogin(null); return; }
      if (!r.ok) { err.textContent = r.text || 'That did not work.'; return; }
      S.nav = [{ screen: 'browse' }, { screen: 'mine' }];
      S.flash = { ok: true, text: r.text || (v.edit ? DONE.updated : DONE.created) };
      render();
    });
    put(root, 
      backBtn(),
      h('div.bold', { style: 'color:var(--brand-orange)', text: v.edit ? 'Edit your offer' : 'Post an offer' }),
      itemBox,
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:2px' },
        ...[['buy', 'I want to buy'], ['sell', 'I want to sell']].map(([k, t]) => h('button.btn', {
          text: t,
          style: `padding:5px 0;${f.type === k ? `background:${k === 'sell' ? 'rgb(30,100,40)' : 'rgb(110,40,40)'};border-bottom:2px solid ${k === 'sell' ? GREEN : RED_B}` : ''}`,
          onclick: () => { f.type = k; render(); },
        }))),
      h('label', { style: 'display:flex;align-items:center;gap:6px' }, h('span', { text: 'Quantity', style: 'width:64px' }), qty,
        have ? btn('All', () => { f.quantity = String(have.quantity); qty.value = f.quantity; }, 'padding:3px 6px', { class: 'btn small' }) : null),
      h('div', { text: f.type === 'sell' ? 'I expect:' : "I'm offering:" }),
      offersEl,
      f.offers.length < MAX_OFFERS ? btn('+ Another offer', () => { f.offers.push({ items: [{ itemId: COINS, name: 'Coins', quantity: '' }] }); render(); }, 'padding:3px 6px;align-self:flex-start', { class: 'btn small' }) : null,
      h('label', { style: 'display:flex;flex-direction:column;gap:3px' }, h('span', { text: 'Notes' }), notes),
      muted(`${v.edit ? 'Saving' : 'Posting'} as ${S.session.name || 'you'}. It shows for 24 hours; bump it (every 30 mins) to keep it up. Amounts like 2.5k or 1m work.`),
      err,
      submit);
  }

  // ---- my offers

  async function mineScreen(root) {
    const v = cur();
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, muted('Loading...'));
    put(root, backBtn(), flashEl(), body);
    const p = await page('/market/listings');
    if (cur() !== v) return;
    if (!p) { body.replaceChildren(muted("Couldn't reach the market.")); return; }
    if (p.login) { S.nav.pop(); needLogin({ screen: 'mine' }); return; }
    const d = p.doc;
    const active = rows(d.querySelector('.mk-table:not(.mk-table-rose):not(.mk-table-dim) table'));
    const paused = rows(d.querySelector('.mk-table-rose table'));
    const expired = rows(d.querySelector('.mk-table-dim table'));
    const heads = d.querySelectorAll('.mk-listhead');
    const bulkOn = (i, action) => {
      const f = heads[i] && [...heads[i].querySelectorAll('form')].find((x) => x.getAttribute('action') === action);
      return !!(f && !f.querySelector('button[disabled]'));
    };
    const doIt = async (path, fields = {}) => {
      if (S.busy) return;
      S.busy = true;
      const r = await send(path, fields);
      S.busy = false;
      if (r.login) { needLogin({ screen: 'mine' }); return; }
      S.flash = { ok: r.ok, text: r.text || (r.ok ? 'Done.' : 'That did not work.') };
      render();
    };
    const card = (l, kind) => {
      const since = l.when ? Date.now() - l.when.getTime() : 0;
      const bumpIn = BUMP_MS - since;
      const status = kind === 'expired' ? `Expired ${ago(l.when.getTime() + ACTIVE_MS)} ago`
        : kind === 'paused' ? `Paused · updated ${ago(l.when)} ago`
          : `Updated ${ago(l.when)} ago · ends in ${span(ACTIVE_MS - since)}${bumpIn > 0 ? ` · bump again in ${span(bumpIn)}` : ''}`;
      const actsEl = h('div', { style: 'display:flex;gap:3px;flex-wrap:wrap' });
      const confirmRemove = () => {
        actsEl.replaceChildren(h('div', { style: 'flex:1;padding:6px;background:var(--darker-gray);border:1px solid var(--border)' },
          h('div.bold.white', { text: 'Remove this offer?' }),
          muted('It comes off the market straight away.', 'padding:3px 0 5px'),
          h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px' },
            btn('Remove', () => doIt(`/market/listings/${l.id}/delete`), 'background:rgb(120,30,30)'),
            btn('Keep it', () => fillActs()))));
      };
      const fillActs = () => {
        const list = [];
        if (l.can.bump) list.push(act('Bump', () => doIt(`/market/listings/${l.id}/bump`), kind !== 'expired' && bumpIn > 0 ? 'rgb(110,110,110)' : AMBER, kind !== 'expired' && bumpIn > 0 ? { disabled: true, tip: `You can bump it again in ${span(bumpIn)}` } : {}));
        if (l.can.edit) list.push(act('Edit', () => go('post', { edit: l.id, item: l.item })));
        if (l.can.pause) list.push(act('Pause', () => doIt(`/market/listings/${l.id}/pause`), ROSE, { tip: 'Hide it from the market (when you log off)' }));
        if (l.can.unpause) list.push(act('Unpause', () => doIt(`/market/listings/${l.id}/unpause`), GREEN));
        if (l.can.sell && kind !== 'expired') list.push(act(l.type === 'buy' ? 'Bought' : 'Sold', () => go('sold', { listing: l }), GREEN, { tip: `Mark it ${l.type === 'buy' ? 'bought' : 'sold'}` }));
        if (l.can.delete) list.push(act('✕', confirmRemove, RED_B, { tip: 'Remove' }));
        actsEl.replaceChildren(...list);
      };
      fillActs();
      return h('div.mk-card', { style: kind === 'paused' ? 'background:rgb(52,40,44)' : kind === 'expired' ? 'opacity:0.8' : '' },
        h('div', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer', tip: offerTip(l), onclick: () => go('item', { item: l.item, type: l.type }) },
          img(l.item.id, undefined, 32),
          h('div', { style: 'flex:1;min-width:0' },
            h('div', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' },
              h('span', { text: `[${l.type === 'buy' ? 'B' : 'S'}] `, style: `color:${l.type === 'buy' ? RED_B : GREEN}` }),
              h('span.white', { text: `${gold(l.quantity)} ${l.item.name}` })),
            offerLine(l))),
        l.notes ? muted(`"${l.notes}"`, 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap') : null,
        muted(status),
        actsEl);
    };
    const head = (text, color, ...buttons) => h('div', { style: 'display:flex;align-items:center;gap:4px;padding-top:4px' }, h('span.bold', { text, style: `color:${color};flex:1` }), ...buttons);
    const none = (t) => muted(t, 'padding:2px 0');
    body.replaceChildren(
      head(`Active (${active.length})`, '#fff',
        act('Bump all', () => doIt('/market/bump'), AMBER, bulkOn(0, '/market/bump') ? {} : { disabled: true, tip: 'None can be bumped yet (every 30 mins)' }),
        act('Pause all', () => doIt('/market/pause'), ROSE, active.length ? {} : { disabled: true })),
      ...(active.length ? active.map((l) => card(l, 'active')) : [none('No active offers.')]),
      head(`Paused (${paused.length})`, ROSE, act('Unpause all', () => doIt('/market/pause', { action: 'unpause' }), GREEN, paused.length ? {} : { disabled: true })),
      muted('Pause when you log off, so nobody chases you.'),
      ...(paused.length ? paused.map((l) => card(l, 'paused')) : [none('None paused.')]),
      head(`Expired (${expired.length})`, AMBER, act('Bump all', () => doIt('/market/bump', { scope: 'expired' }), AMBER, expired.length ? {} : { disabled: true })),
      muted('Bump or edit one to put it back up. They stay here a week.'),
      ...(expired.length ? expired.map((l) => card(l, 'expired')) : [none('None expired.')]),
      btn('Post an offer', () => go('post', {}), 'background:rgb(30,100,40);margin-top:4px'));
  }

  // ---- mark sold

  function soldScreen(root) {
    const v = cur();
    const l = v.listing;
    if (!v.form) v.form = { quantity: String(l.quantity), offers: l.offers.map((o) => ({ items: o.items.map((i) => ({ itemId: i.itemId, name: i.name, quantity: String(i.quantity) })) })) };
    const f = v.form;
    const err = h('div.small', { style: `color:${RED_B}` });
    const qty = h('input.mk-in', { type: 'text', maxlength: '20', style: 'width:64px' });
    qty.value = f.quantity;
    qty.addEventListener('input', () => { f.quantity = qty.value; });
    const offersEl = h('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    f.offers.forEach((o, oi) => {
      const box = h('div', { style: 'display:flex;flex-direction:column;gap:4px;padding:6px;background:var(--darker-gray);border:1px solid var(--border)' });
      if (f.offers.length > 1) {
        box.append(h('div.small.muted', { style: 'display:flex' }, h('span', { text: `Offer ${oi + 1}`, style: 'flex:1' }),
          h('a.small', { href: '#', text: 'not this one', onclick: (e) => { e.preventDefault(); f.offers.splice(oi, 1); render(); } })));
      }
      o.items.forEach((it, ii) => {
        const inp = h('input.mk-in', { type: 'text', maxlength: '20', style: 'width:72px' });
        inp.value = it.quantity;
        inp.addEventListener('input', () => { it.quantity = inp.value; });
        box.append(h('div', { style: 'display:flex;align-items:center;gap:4px' }, img(it.itemId, amount(it.quantity) || 1, 20),
          h('span', { text: it.name, style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }), inp,
          o.items.length > 1 ? h('button.mk-x', { text: '×', onclick: () => { o.items.splice(ii, 1); render(); } }) : null));
      });
      const add = h('div');
      add.append(btn('+ Add an item', () => {
        add.replaceChildren(itemPicker('Search for an item', (picked) => {
          if (!o.items.some((x) => x.itemId === picked.id)) o.items.push({ itemId: picked.id, name: picked.name, quantity: '' });
          render();
        }));
      }, 'padding:2px 6px', { class: 'btn small' }));
      box.append(add);
      offersEl.append(box);
    });
    const confirm = h('button.btn.bold', { text: 'Confirm', style: 'background:rgb(30,100,40)' });
    confirm.addEventListener('click', async () => {
      const n = amount(f.quantity, true);
      if (n === null || n > l.quantity) { err.textContent = `Enter a quantity between 1 and ${num(l.quantity)}.`; return; }
      for (const o of f.offers) for (const i of o.items) if (amount(i.quantity) === null) { err.textContent = `Please enter how many ${i.name}.`; return; }
      confirm.disabled = true;
      const r = await send(`/market/listings/${l.id}/sell`, {
        quantity: f.quantity.trim(),
        offers: JSON.stringify(f.offers.map((o) => ({ title: 'For each item:', items: o.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity.trim().replace(/,/g, '') })) }))),
      });
      confirm.disabled = false;
      if (r.login) { needLogin(null); return; }
      if (!r.ok) { err.textContent = r.text || 'That did not work.'; return; }
      S.nav.pop();
      S.flash = { ok: true, text: r.text || DONE.sold };
      render();
    });
    const word = l.type === 'buy' ? 'bought' : 'sold';
    put(root, 
      backBtn(),
      h('div.bold', { style: `color:${GREEN}`, text: `Mark ${word}` }),
      h('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px;background:var(--darker-gray);border:1px solid var(--border)' },
        img(l.item.id, undefined, 32),
        h('div', { style: 'min-width:0' }, h('div.white', { text: l.item.name }), muted(`Your offer: ${gold(l.quantity)} ${l.type === 'buy' ? 'wanted' : 'for sale'}`))),
      h('label', { style: 'display:flex;align-items:center;gap:6px' }, h('span', { text: `Quantity ${word} (up to ${num(l.quantity)})`, style: 'flex:1' }), qty),
      h('div', { text: 'What the trade was for (each):' }),
      offersEl,
      muted("Shows under Sales and on the item's page, so other players see what it really goes for. Any left stays up."),
      err,
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:4px' }, confirm, btn('Cancel', back)));
  }

  // ------------------------------------------------------------------ render

  const SCREENS = { browse: browseScreen, login: loginScreen, item: itemScreen, yours: yoursScreen, post: postScreen, mine: mineScreen, sold: soldScreen };

  function render(keepScroll) {
    if (!rootEl) return;
    const body = h('div.mk-screen');
    const top = rootEl.scrollTop;
    rootEl.replaceChildren(body);
    rootEl.scrollTop = keepScroll === true ? top : 0;
    const fn = SCREENS[cur().screen] || browseScreen;
    const r = fn(body);
    if (r && r.catch) r.catch((e) => { body.append(muted(`Something went wrong: ${e && e.message}`)); });
  }

  window.Panels.push({
    id: 'market',
    tooltip: 'Market',
    icon: 'market_icon.png',
    priority: 6,
    watch: ['bank', 'items'],
    async render(root, opts = {}) {
      // inventory and bank changes only matter on Your items (the other screens keep what you typed)
      if (!opts.fresh && rootEl === root) {
        if ((opts.changed || []).some((k) => k === 'bank' || k === 'items') && cur().screen === 'yours') {
          const v = cur();
          const t = rootEl.querySelector('.mk-scroll');
          v.listTop = t ? t.scrollTop : 0;
          render(true);
        }
        return;
      }
      rootEl = root;
      if (!S.started) {
        S.started = true;
        const s = await window.lostlite.marketSession();
        if (s && s.loggedIn) {
          S.session.loggedIn = true;
          page('/market/listings').then(() => { if (cur().screen === 'browse') render(); });
        }
      }
      render();
      clearInterval(timer);
      timer = setInterval(() => {
        if (App.activeId !== 'market' || !document.body.contains(rootEl)) { clearInterval(timer); timer = null; return; }
        if (cur().screen === 'browse' && browseScreen.reload && !rootEl.querySelector('input:focus')) browseScreen.reload();
      }, REFRESH_MS);
    },
  });
})();
