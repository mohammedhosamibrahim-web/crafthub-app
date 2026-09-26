/* ==========================================================================
 * CraftHub — core runtime (state, helpers, API client, router primitives)
 * ES module. No build step.
 * ========================================================================== */

/* ----------------------------- constants ---------------------------- */
export const LS = {
  token: 'crafthub.token',
  theme: 'crafthub.theme',
  lang: 'crafthub.lang',
  muted: 'crafthub.muted_rooms',
  hiddenMsgs: 'crafthub.hidden_msgs',
};

export const MIN_WITHDRAWAL = 100;

export const EMOJIS = ('😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😗 😋 😛 🤪 🤨 🧐 🤓 😎 🥳 😏 ' +
  '😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 ' +
  '🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👻 💀 👽 🤖 ' +
  '👍 👎 👌 ✌️ 🤞 🤟 🤘 👏 🙌 🙏 💪 🦾 🖐️ ✋ 👋 🤝 💅 👊 ✊ 🫡 🫶 ❤️ 🧡 💚 💙 💜 🖤 🤍 💔 ✨ 🔥 ⭐ 🎉 🎊 🎁 🏆 🥇 ⚡ 💯 ✅ ❌ ⚠️ 📌 📎 🔔 💬 📷 🎥 🎵 🎧 💰 💵 💳 📈 📉 🚀 🛠️ ⚙️ 🔧 🔩 🧰 📱 💻 🖥️ ⌨️ 🖱️ 🌍 🌎 🌏 🔒 🔐 🗝️ 📅 ⏰ ⏳ ⚔️ 🛡️ 🩺 💉 💊 🩹 🧬 🔬 🧪 🏗️ 🏭 🚗 🚙 🚕 🚌 🚜 🏍️ ✈️ 🚁 ⛵ 🚢 🏨 🍽️ 👨‍🍳 👩‍🍳 🌾 🐾 🎨 🎭 🎬 📺 📻 🎤 🎸 🎹 🥁 🏀 ⚽ 🎾 🏐 🎳 🏓 🥊 🧘 🏃 🚴 🏊 💼 📊 📋 📁 🗂️ 📝 ✏️ 🖊️ 📖 📚 🎓 🏫 🌡️ 🧭 🗺️ 🕐').split(' ');

/* ------------------------------- state ------------------------------ */
export const state = {
  boot: null,
  token: localStorage.getItem(LS.token) || '',
  user: null,
  theme: localStorage.getItem(LS.theme) || 'light',
  lang: localStorage.getItem(LS.lang) || 'ar',
  mutedRooms: JSON.parse(localStorage.getItem(LS.muted) || '{}'),
  hiddenMsgs: JSON.parse(localStorage.getItem(LS.hiddenMsgs) || '{}'),
  route: { name: 'home', params: {} },
  cache: {},
  chat: { slug: null, room: null, messages: [], paused: false, pendingReply: null, lastId: 0, timer: null },
  installPrompt: null,
  toastTimer: 0,
};

/* ------------------------------- helpers ---------------------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const ch of list) {
    if (ch === null || ch === undefined || ch === false || ch === '') continue;
    node.append(ch instanceof Node ? ch : document.createTextNode(String(ch)));
  }
  return node;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

export function avatarNode(src, name, cls = '') {
  if (src) {
    return el('img', {
      src, alt: name || '', loading: 'lazy',
      onerror: (e) => { e.target.replaceWith(el('span', { class: cls, text: initials(name) })); },
    });
  }
  return el('span', { class: cls, text: initials(name) });
}

export function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
  return String(n);
}

export function fmtMoney(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function toDate(iso) {
  if (!iso) return null;
  const s = String(iso);
  const norm = s.includes('T') ? s : s.replace(' ', 'T');
  const withZ = /Z$|[+-]\d\d:\d\d$/.test(norm) ? norm : norm + 'Z';
  const d = new Date(withZ);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function relTime(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('now');
  if (mins < 60) return t('m_ago', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('h_ago', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t('d_ago', { n: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('mo_ago', { n: months });
  return t('y_ago', { n: Math.floor(months / 12) });
}

/* -------------------------------- i18n ------------------------------ */
export function t(key, vars) {
  const dicts = (state.boot && state.boot.i18n && state.boot.i18n.dictionaries) || {};
  const dict = dicts[state.lang] || {};
  let out = dict[key] != null ? dict[key] : (dicts.en && dicts.en[key] != null ? dicts.en[key] : key);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function langMeta(code) {
  const list = (state.boot && state.boot.i18n && state.boot.i18n.languages) || [];
  return list.find((l) => l.code === code) || { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl' };
}

export const dir = () => langMeta(state.lang).dir;

export function applyLang(code) {
  state.lang = code;
  localStorage.setItem(LS.lang, code);
  document.documentElement.lang = code;
  document.documentElement.dir = dir();
}

export function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem(LS.theme, theme);
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0F0F0F' : '#FFFFFF');
}

/* ------------------------------ API client -------------------------- */
export async function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

/* ------------------------------- toast ------------------------------ */
export function toast(msg, kind = 'success', ms = 3200) {
  const host = $('#toast-host');
  if (!host) return;
  const node = el('div', { class: `toast ${kind}`, text: msg });
  host.append(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateY(8px)'; node.style.transition = 'all .25s'; }, ms - 320);
  setTimeout(() => node.remove(), ms);
}

/* ------------------------------ overlays ---------------------------- */
export function openModal({ title, body, footer, wide }) {
  closeModal();
  const overlay = el('div', { class: 'overlay', id: 'modal-overlay' }, [
    el('div', { class: 'modal', style: wide ? 'width:min(1000px,100%)' : '' }, [
      el('div', { class: 'modal-head' }, [
        el('h3', { text: title || '' }),
        el('button', { class: 'menu-btn', 'aria-label': 'close', onclick: closeModal, html: '<i class="fa-solid fa-xmark"></i>' }),
      ]),
      el('div', { class: 'modal-body' }, [body]),
      footer ? el('div', { class: 'modal-foot' }, Array.isArray(footer) ? footer : [footer]) : null,
    ].filter(Boolean)),
  ]);
  overlay.addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.body.append(overlay);
  return overlay;
}
export function closeModal() { const n = $('#modal-overlay'); if (n) n.remove(); }
export function closeDrawer() { const n = $('#side-drawer'); if (n) n.remove(); }

/* --------------------------- context menu --------------------------- */
export function openCtx(x, y, items) {
  closeCtx();
  const menu = el('div', { class: 'ctx-menu', id: 'ctx-menu' });
  for (const it of items) {
    if (it.sep) { menu.append(el('div', { class: 'sep' })); continue; }
    if (it.head) { menu.append(el('div', { class: 'head', text: it.head })); continue; }
    menu.append(el('button', {
      class: it.danger ? 'danger' : '',
      onclick: (e) => { e.stopPropagation(); closeCtx(); if (it.onClick) it.onClick(); },
    }, [el('i', { class: it.icon || 'fa-solid fa-circle' }), el('span', { text: it.label })]));
  }
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + 'px';
  const off = (e) => { if (!menu.contains(e.target)) { closeCtx(); document.removeEventListener('click', off); } };
  setTimeout(() => document.addEventListener('click', off), 0);
}
export function closeCtx() { const n = $('#ctx-menu'); if (n) n.remove(); }

/* ------------------------------- router ----------------------------- */
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const params = {};
  new URLSearchParams(queryPart || '').forEach((v, k) => { params[k] = v; });
  return { segments, params };
}

export function navigate(to) {
  const target = to.startsWith('#') ? to : '#/' + String(to).replace(/^\//, '');
  if (location.hash === target) { if (window.__rerender) window.__rerender(); return; }
  location.hash = target;
}

export function resolveRoute() {
  const { segments, params } = parseHash();
  const [a, b] = segments;
  if (!a) return { name: 'home', params };
  switch (a) {
    case 'watch': return { name: 'watch', params: Object.assign({ id: Number(b) }, params) };
    case 'shorts': return { name: 'shorts', params };
    case 'live': return { name: 'live', params };
    case 'playlists': return { name: 'playlists', params };
    case 'community': return { name: 'community', params: Object.assign({ slug: b || 'general' }, params) };
    case 'channel': return { name: 'channel', params: Object.assign({ handle: b || '' }, params) };
    case 'studio': return { name: 'studio', params };
    case 'wallet': return { name: 'wallet', params };
    case 'admin': return { name: 'admin', params };
    case 'settings': return { name: 'settings', params };
    case 'legal': return { name: 'legal', params };
    case 'login': return { name: 'login', params };
    case 'signup': return { name: 'signup', params };
    case 'trending': return { name: 'trending', params };
    default: return { name: a, params };
  }
}

/* --------------------------- shared widgets ------------------------- */
export function thumbNode(v, opts = {}) {
  const kids = [];
  if (v && v.thumbnail) kids.push(el('img', { src: v.thumbnail, alt: v.title || '', loading: 'lazy' }));
  else kids.push(el('div', {
    style: 'width:100%;height:100%;display:grid;place-items:center;color:var(--text-dim)',
    html: '<i class="fa-solid fa-film" style="font-size:30px"></i>',
  }));
  if (v && v.is_live) kids.push(el('span', { class: 'badge live live-tag', html: '<i class="fa-solid fa-circle" style="font-size:7px"></i> &nbsp;LIVE' }));
  else if (v && v.duration) kids.push(el('span', { class: 'dur', text: fmtTime(v.duration) }));
  if (!opts.noOverlay) kids.push(el('span', { class: 'play-ov', html: '<i class="fa-solid fa-circle-play"></i>' }));
  return el('div', {
    class: 'thumb', style: 'cursor:pointer', role: 'link',
    onclick: () => navigate(`watch/${v.id}`),
  }, kids);
}

export function videoCard(v) {
  return el('article', { class: 'video-card' }, [
    thumbNode(v),
    el('div', { class: 'meta' }, [
      el('div', {
        class: 'cha', style: 'cursor:pointer',
        onclick: (e) => { e.stopPropagation(); navigate(`channel/${v.channel_handle}`); },
      }, [avatarNode(v.channel_avatar, v.channel_name)]),
      el('div', { style: 'min-width:0' }, [
        el('h4', { class: 'vt', text: v.title, style: 'cursor:pointer', onclick: () => navigate(`watch/${v.id}`) }),
        el('div', { class: 'vc' }, [
          el('span', { text: v.channel_name, style: 'cursor:pointer', onclick: () => navigate(`channel/${v.channel_handle}`) }),
          v.channel_verified ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:#3b82f6;margin-inline-start:5px' }) : null,
        ].filter(Boolean)),
        el('div', { class: 'vc', text: `${fmtNum(v.views)} ${t('views')} • ${relTime(v.created_at)}` }),
      ]),
    ]),
  ]);
}

export function emptyState(icon, text) {
  return el('div', { class: 'empty' }, [
    el('i', { class: icon }),
    el('p', { text }),
  ]);
}

/* ------------------------------------------------------------------ *
 * Ads
 *
 * Fetches /api/ads once per session and renders the admin's custom ad
 * unit. If nothing is configured (or ads are off) it returns null and
 * the caller renders nothing — no error, no AdMob key prompt.
 * ------------------------------------------------------------------ */
let __adCache;

export async function loadAdUnit(platform) {
  if (__adCache !== undefined && !platform) return __adCache;
  try {
    const url = '/api/ads' + (platform ? `?platform=${encodeURIComponent(platform)}` : '');
    const data = await get(url);
    if (!data || !data.enabled) {
      if (!platform) __adCache = null;
      return null;
    }
    if (!platform) __adCache = data;
    return data;
  } catch {
    // Silent fallback — a failed ad fetch must never surface to the user.
    if (!platform) __adCache = null;
    return null;
  }
}

export async function adBanner(platform) {
  const unit = await loadAdUnit(platform);
  if (!unit || !unit.enabled) return null;

  const tag = el('span', { class: 'ad-tag', text: t('ad') || 'Ad' });

  if (unit.banner && unit.link) {
    return el('div', { class: 'ad-banner' }, [
      el('a', { href: unit.link, target: '_blank', rel: 'noopener sponsored' }, [
        el('img', { src: unit.banner, alt: t('sponsored') || 'Sponsored', loading: 'lazy' }),
      ]),
      tag,
    ]);
  }

  // Text-only fallback when only a link is configured.
  if (unit.link) {
    return el('div', { class: 'ad-banner text-only' }, [
      el('a', { href: unit.link, target: '_blank', rel: 'noopener sponsored', style: 'text-decoration:none;color:inherit' }, [
        el('b', { text: t('sponsored') || 'Sponsored' }),
        el('div', { class: 'ad-cta', html: '<i class="fa-solid fa-arrow-up-right-from-square"></i> ' + (t('visit') || 'Visit') }),
      ]),
      tag,
    ]);
  }

  return null;
}

export function loadingBlock(text) {
  return el('div', { class: 'empty' }, [
    el('i', { class: 'fa-solid fa-spinner fa-spin' }),
    el('p', { text: text || t('loading') }),
  ]);
}

export function statCard(k, v, sub, cls) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'k', text: k }),
    el('div', { class: 'v ' + (cls || ''), text: v }),
    sub ? el('div', { class: 'sub', text: sub }) : null,
  ].filter(Boolean));
}

export function progressBar(value, target, green) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return el('div', { class: 'progress' + (green ? ' green' : '') }, [
    el('i', { style: `width:${pct.toFixed(1)}%` }),
  ]);
}
