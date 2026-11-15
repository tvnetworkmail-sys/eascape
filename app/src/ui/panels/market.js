'use strict';
// Market panel (ours): the offers on the website's market (2006rs.com/market), in the sidebar.
// Buying and Selling tabs like the website's, newest first, with a search box. Each row shows the
// item, how many, what's offered for it, who posted it and how long ago; click a row to open that
// item's page on the website, where you post and manage your own listings. The listings come from
// the website's public API (main.js 'market-listings'), refreshed every minute while it's open.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const SITE = 'https://2006rs.com';
  const COINS = 995;
  const COIN_ICONS = [1, 2, 3, 4, 5, 25, 100, 250, 1000, 10000]; // the website's coin pile icons
  const REFRESH_MS = 60 * 1000;

  const view = { type: 'sell', q: '' };
  try { view.type = localStorage.getItem('market.type') === 'buy' ? 'buy' : 'sell'; } catch { /* no storage */ }
  const data = { buy: null, sell: null };
  const loaded = { buy: 0, sell: 0 };
  let loading = false;
  let failed = false;
  let timer = null;
  let rootEl = null;
  let search = null;
  let listEl = null;

  // the website's own formats (fmtGold, marketAgo)
  function gold(v) {
    const n = (x) => Number(x.toFixed(2)).toLocaleString('en-US');
    if (v >= 1000000) return `${n(v / 1000000)}M`;
    if (v >= 1000) return `${n(v / 1000)}K`;
    return Number(v).toLocaleString('en-US');
  }
  function ago(iso) {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
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
  function iconUrl(id, qty) {
    if (id === COINS && qty !== undefined) return `${SITE}/img/market-items/${COINS}_${COIN_ICONS.filter((d) => d <= qty).pop() || 1}.png`;
    return `${SITE}/img/market-items/${id}.png`;
  }
  function img(id, qty, size) {
    const el = h('img', { src: iconUrl(id, qty), alt: '', style: `width:${size}px;height:${size}px;object-fit:contain;image-rendering:pixelated;flex:none` });
    el.addEventListener('error', () => { el.style.visibility = 'hidden'; });
    return el;
  }

  async function load(type, force) {
    if (loading) return;
    if (!force && data[type] && Date.now() - loaded[type] < REFRESH_MS) return;
    loading = true;
    const list = await window.lostlite.marketListings(type);
    loading = false;
    failed = list === null;
    if (list) { data[type] = list; loaded[type] = Date.now(); }
    showList();
  }

  function row(l) {
    const offers = (l.offers || []).flatMap((o) => o.items || []);
    const shown = offers.slice(0, 3);
    const more = offers.length - shown.length;
    const tipText = [`${l.type === 'buy' ? 'Buying' : 'Selling'} ${Number(l.quantity).toLocaleString('en-US')} x ${l.item.name}`]
      .concat((l.offers || []).map((o) => `${o.title}\n${(o.items || []).map((i) => `  ${Number(i.quantity).toLocaleString('en-US')} ${i.name}`).join('\n')}`))
      .concat(l.notes ? [`"${l.notes}"`] : [])
      .concat([`Posted by ${l.username}, ${ago(l.updatedAt)} ago`, 'Click to open it on the website'])
      .join('\n');
    const el = h('div.mk-row', { tip: tipText },
      img(l.item.id, undefined, 32),
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' },
          h('span', { text: `[${l.type === 'buy' ? 'B' : 'S'}] `, style: `color:${l.type === 'buy' ? '#6fb6ff' : '#7fd77f'}` }),
          h('span.white', { text: `${gold(l.quantity)} ${l.item.name}` })),
        h('div.small', { style: 'display:flex;align-items:center;gap:3px;flex-wrap:wrap' },
          shown.length ? h('span.muted', { text: 'for' }) : null,
          ...shown.map((i) => h('span', { style: 'display:inline-flex;align-items:center;gap:1px' }, img(i.itemId, i.quantity, 18), h('span', { text: gold(i.quantity) }))),
          more > 0 ? h('span.muted', { text: `+${more}` }) : null),
        h('div.small.muted', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: `${l.username} · ${ago(l.updatedAt)}${l.notes ? ` · ${l.notes}` : ''}` })));
    el.addEventListener('click', () => window.lostlite.openExternal(`${SITE}/market/items/${encodeURIComponent(l.item.slug)}?type=${l.type}`));
    return el;
  }

  function showList() {
    if (!listEl) return;
    const list = data[view.type];
    const q = view.q.trim().toLowerCase();
    if (!list) {
      listEl.replaceChildren(h('div.small.muted', { style: 'padding:8px 0', text: failed ? "Couldn't reach the market." : 'Loading...' }));
      return;
    }
    const hits = q ? list.filter((l) => l.item.name.toLowerCase().includes(q) || (l.offers || []).some((o) => (o.items || []).some((i) => i.name.toLowerCase().includes(q)))) : list;
    listEl.replaceChildren(...(hits.length ? hits.map(row) : [h('div.small.muted', { style: 'padding:8px 0', text: q ? 'No offers match.' : `Nobody is ${view.type === 'buy' ? 'buying' : 'selling'} anything right now.` })]));
  }

  function tabButton(type, text) {
    return h('button.btn', {
      text,
      style: `flex:1;${view.type === type ? 'background:var(--darker-gray-hover);color:#fff' : ''}`,
      onclick: () => {
        view.type = type;
        try { localStorage.setItem('market.type', type); } catch { /* no storage */ }
        render();
        load(type);
      },
    });
  }

  function render() {
    if (!rootEl) return;
    if (!search) search = UI.searchField('', (q) => { view.q = q || ''; showList(); }, 'Search an item');
    listEl = h('div', { style: 'display:flex;flex-direction:column;gap:2px;margin-top:6px' });
    rootEl.replaceChildren(h('div.pad', {},
      h('div', { style: 'display:flex;gap:4px;margin-bottom:6px' }, tabButton('sell', 'Selling'), tabButton('buy', 'Buying')),
      search,
      listEl,
      h('div', { style: 'display:flex;gap:4px;margin-top:8px' },
        h('button.btn', { text: 'Refresh', style: 'flex:1', onclick: () => load(view.type, true) }),
        h('button.btn', { text: 'Open market', style: 'flex:1', tip: 'Post and manage your listings on the website', onclick: () => window.lostlite.openExternal(`${SITE}/market?type=${view.type}`) }))));
    showList();
  }

  window.Panels.push({
    id: 'market',
    tooltip: 'Market',
    icon: 'market_icon.png',
    priority: 6,
    render(root) {
      rootEl = root;
      render();
      load(view.type);
      clearInterval(timer);
      timer = setInterval(() => {
        if (App.activeId !== 'market' || !document.body.contains(listEl)) { clearInterval(timer); timer = null; return; }
        load(view.type, true);
      }, REFRESH_MS);
    },
  });
})();
