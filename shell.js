/* Shell: top bar + sidebar + drawer */
import {
  el, t, state, navigate, avatarNode, toast, openModal, closeDrawer, post, LS,
} from '../core.js';

export function topbar() {
  const user = state.user;
  const notifDot = (state.boot && state.boot.notifications && state.boot.notifications.length) ? true : false;

  const menuBtn = el('button', {
    class: 'menu-btn', 'aria-label': 'menu',
    onclick: () => toggleSidebar(),
    html: '<i class="fa-solid fa-bars"></i>',
  });

  // Brand: clicking must NOT trigger random navigation (spec §11)
  const brand = el('div', { class: 'brand', title: 'CraftHub', role: 'banner' }, [
    el('span', { class: 'brand-mark', text: 'C' }),
    el('span', { class: 'brand-name' }, ['Craft', el('span', { class: 'hub', text: 'Hub' })]),
  ]);

  const search = el('form', {
    class: 'search-wrap',
    onsubmit: (e) => {
      e.preventDefault();
      const q = ($q.value || '').trim();
      if (!q) return;
      state.cache.searchQuery = q;
      navigate('home?q=' + encodeURIComponent(q));
    },
  }, [
    el('div', { class: 'search-bar' }, [
      el('i', { class: 'fa-solid fa-magnifying-glass muted' }),
      ($q = el('input', { type: 'search', placeholder: t('search') + '…', 'aria-label': t('search') })),
      el('button', { type: 'submit', 'aria-label': 'search', html: '<i class="fa-solid fa-arrow-right"></i>' }),
    ]),
  ]);

  const right = el('div', { class: 'topbar-right' }, [
    el('button', {
      class: 'icon-btn', title: t('language'), 'aria-label': t('language'),
      onclick: () => navigate('settings?tab=language'), html: '<i class="fa-solid fa-globe"></i>',
    }),
    el('button', {
      class: 'icon-btn', title: t('theme'),
      onclick: toggleTheme,
      html: `<i class="fa-solid ${state.theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`,
    }),
    el('button', {
      class: 'icon-btn', title: t('notifications'), 'aria-label': t('notifications'),
      onclick: showNotifications,
      html: '<i class="fa-solid fa-bell"></i>',
    }, notifDot ? [el('span', { class: 'dot' })] : []),
    user
      ? el('button', {
          class: 'avatar-btn', title: user.full_name,
          onclick: () => openAccountMenu(),
        }, [avatarNode(user.avatar, user.full_name)])
      : el('button', {
          class: 'btn-subscribe-top',
          onclick: () => navigate('signup'),
        }, [el('i', { class: 'fa-solid fa-user-plus' }), el('span', { text: t('signup') })]),
  ]);

  let $q;
  return el('header', { class: 'topbar' }, [menuBtn, el('div', { class: 'topbar-left' }, [brand]), search, right]);
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
}

export function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = next;
  localStorage.setItem(LS.theme, next);
  document.documentElement.setAttribute('data-theme', next);
  if (window.__rerender) window.__rerender();
}

export function sidebar(route) {
  const user = state.user;
  const item = (id, icon, label, to, extra) => el('button', {
    class: 'nav-item' + (route.name === id ? ' active' : ''),
    onclick: () => { navigate(to); if (window.innerWidth <= 900) document.getElementById('sidebar')?.classList.remove('open'); },
  }, [
    el('i', { class: `nav-ico ${icon}` }),
    el('span', { text: label }),
    extra || null,
  ].filter(Boolean));

  const groups = [];

  groups.push(el('nav', { class: 'nav-group' }, [
    item('home', 'fa-solid fa-house', t('home'), 'home'),
    item('shorts', 'fa-solid fa-bolt', t('shorts'), 'shorts'),
    item('live', 'fa-solid fa-tower-broadcast live-dot', t('live'), 'live'),
    item('trending', 'fa-solid fa-fire', t('trending'), 'trending'),
  ]));

  if (user) {
    groups.push(el('nav', { class: 'nav-group' }, [
      el('div', { class: 'nav-title', text: t('my_channel') }),
      item('channel', 'fa-solid fa-circle-user', t('my_channel'), `channel/${user.handle}`),
      item('community', 'fa-solid fa-comments', t('community'), 'community/general'),
      item('playlists', 'fa-solid fa-list', t('playlists'), 'playlists'),
      item('wallet', 'fa-solid fa-wallet', t('wallet'), 'wallet'),
      item('studio', 'fa-solid fa-chart-line', t('studio'), 'studio'),
    ]));
  } else {
    groups.push(el('nav', { class: 'nav-group' }, [
      el('div', { class: 'nav-title', text: t('community') }),
      item('community', 'fa-solid fa-comments', t('community'), 'community/general'),
    ]));
  }

  groups.push(el('nav', { class: 'nav-group' }, [
    item('settings', 'fa-solid fa-gear', t('settings'), 'settings'),
    item('legal', 'fa-solid fa-scale-balanced', t('terms'), 'legal'),
    user && (user.role === 'admin' || user.role === 'moderator')
      ? item('admin', 'fa-solid fa-shield-halved', t('admin'), 'admin')
      : null,
    el('button', {
      class: 'nav-item',
      onclick: () => {
        if (state.installPrompt) {
          state.installPrompt.prompt();
          state.installPrompt.userChoice.then(() => { state.installPrompt = null; });
        } else {
          toast(t('install_hint'), 'info');
        }
      },
    }, [el('i', { class: 'nav-ico fa-solid fa-download' }), el('span', { text: t('install_app') })]),
  ].filter(Boolean)));

  return el('aside', { class: 'sidebar', id: 'sidebar' }, groups);
}

function openAccountMenu() {
  const u = state.user;
  if (!u) return;
  navigate(`channel/${u.handle}`);
}

function showNotifications() {
  const list = (state.boot && state.boot.notifications) || [];
  const body = list.length
    ? el('div', { class: 'stack' }, list.map((n) => el('div', { class: 'card' }, [
        el('div', { class: 'row between' }, [
          el('b', { text: n.title }),
          n.is_broadcast ? el('span', { class: 'badge red', text: t('broadcast') }) : null,
        ].filter(Boolean)),
        n.body ? el('p', { class: 'muted', style: 'margin:6px 0 0', text: n.body }) : null,
        el('div', { class: 'dim', style: 'margin-top:6px', text: rel(n.created_at) }),
      ])))
    : el('div', { class: 'empty' }, [el('i', { class: 'fa-solid fa-bell-slash' }), el('p', { text: t('no_notifications') })]);

  openModal({ title: t('notifications'), body });
}

function rel(iso) {
  try {
    const d = new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
    return d.toLocaleString();
  } catch { return ''; }
}

export function drawerSettings() {
  const d = el('aside', { class: 'drawer', id: 'side-drawer' });
  const close = el('button', { class: 'menu-btn', onclick: closeDrawer, html: '<i class="fa-solid fa-xmark"></i>' });
  d.append(el('div', { class: 'row between', style: 'margin-bottom:16px' }, [
    el('h3', { text: t('settings'), style: 'margin:0' }), close,
  ]));
  d.append(el('div', { class: 'stack' }, [
    el('div', { class: 'field' }, [
      el('label', { text: t('theme') }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn' + (state.theme === 'light' ? ' success' : ''), onclick: () => { state.theme = 'light'; localStorage.setItem(LS.theme, 'light'); document.documentElement.setAttribute('data-theme', 'light'); if (window.__rerender) window.__rerender(); }, html: '<i class="fa-solid fa-sun"></i> ' + t('light') }),
        el('button', { class: 'btn' + (state.theme === 'dark' ? ' success' : ''), onclick: () => { state.theme = 'dark'; localStorage.setItem(LS.theme, 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); if (window.__rerender) window.__rerender(); }, html: '<i class="fa-solid fa-moon"></i> ' + t('dark') }),
      ]),
    ]),
    el('button', { class: 'btn block', onclick: () => { closeDrawer(); navigate('settings?tab=language'); }, html: '<i class="fa-solid fa-globe"></i> ' + t('language') }),
    el('button', { class: 'btn block', onclick: () => { closeDrawer(); navigate('legal'); }, html: '<i class="fa-solid fa-scale-balanced"></i> ' + t('terms') }),
    state.user ? el('button', { class: 'btn block', onclick: () => { closeDrawer(); logout(); }, html: '<i class="fa-solid fa-right-from-bracket"></i> ' + t('logout') }) : null,
  ].filter(Boolean)));
  document.body.append(d);
}

export async function logout() {
  try { await post('/api/auth/logout'); } catch { /* ignore */ }
  localStorage.removeItem(LS.token);
  state.token = '';
  state.user = null;
  state.boot.user = null;
  toast(t('logged_out'));
  navigate('home');
}
