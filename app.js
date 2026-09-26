/* ==========================================================================
 * CraftHub — application entry. Mounts the shell + routes the views.
 * ========================================================================== */
import {
  state, get, el, t, $, navigate, resolveRoute, applyTheme, applyLang, dir,
  toast, api, LS, closeModal, closeDrawer, closeCtx,
} from './core.js';

import { topbar, sidebar, drawerSettings, logout } from './pages/shell.js';
import { homePage, trendingPage, livePage, playlistsPage } from './pages/feed.js';
import { watchPage } from './pages/watch.js';
import { shortsPage } from './pages/shorts.js';
import { communityPage, stopChatPolling } from './pages/chat.js';
import { channelPage } from './pages/channel.js';
import { loginPage, signupPage } from './pages/auth.js';
import { settingsPage } from './pages/settings.js';
import { walletPage } from './pages/wallet.js';
import { studioPage } from './pages/studio.js';
import { adminPage } from './pages/admin.js';
import { legalPage } from './pages/legal.js';

const appRoot = document.getElementById('app');
let rendering = false;

/* ------------------------------ bootstrap ---------------------------- */
async function boot() {
  applyTheme(state.theme);
  // language is applied after we know the dictionaries
  try {
    state.boot = await get('/api/bootstrap');
    if (!state.boot) throw new Error('no bootstrap');
    state.user = state.boot.user || null;
    if (state.user && state.token) localStorage.setItem(LS.token, state.token);
  } catch (e) {
    // Offline / first paint fallback so the shell still renders
    state.boot = state.boot || {
      user: null, countries: [], sectors: [], total_professions: 0,
      i18n: { languages: [{ code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl' }], dictionaries: {}, defaultLang: 'ar' },
      notifications: [],
    };
  }
  if (!state.lang) state.lang = (state.boot.i18n && state.boot.i18n.defaultLang) || 'ar';
  applyLang(state.lang);

  await render();

  window.addEventListener('hashchange', render);
  window.addEventListener('online', () => toast(t('notifications') + ': online'));
  window.addEventListener('offline', () => toast('offline', 'error'));

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
  });

  // global esc closes overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDrawer(); closeCtx(); }
  });

  // service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  }
}

/* -------------------------------- render ----------------------------- */
async function render() {
  if (rendering) return;
  rendering = true;
  try {
    const route = resolveRoute();
    const prev = state.route.name;
    state.route = route;

    if (prev === 'community' && route.name !== 'community') stopChatPolling();

    const isAuthPage = route.name === 'login' || route.name === 'signup';

    appRoot.replaceChildren();
    document.body.classList.toggle('no-sidebar', isAuthPage);

    if (isAuthPage) {
      const page = el('main', { class: 'main wide', id: 'main-region' });
      appRoot.append(page);
      if (route.name === 'login') await loginPage(page);
      else await signupPage(page);
      window.__rerender = render;
      rendering = false;
      return;
    }

    const layout = el('div', { class: 'layout' }, [
      sidebar(route),
      el('main', { class: 'main', id: 'main-region' }),
    ]);
    appRoot.append(topbar(), layout);
    const main = layout.querySelector('#main-region');

    switch (route.name) {
      case 'home': await homePage(main, route.params); break;
      case 'trending': await trendingPage(main); break;
      case 'live': await livePage(main); break;
      case 'playlists': await playlistsPage(main); break;
      case 'watch': await watchPage(main, route.params); break;
      case 'shorts': await shortsPage(main); break;
      case 'community': await communityPage(main, route.params); break;
      case 'channel': await channelPage(main, route.params); break;
      case 'settings': await settingsPage(main, route.params); break;
      case 'wallet': await walletPage(main); break;
      case 'studio': await studioPage(main); break;
      case 'admin': await adminPage(main); break;
      case 'legal': await legalPage(main, route.params); break;
      default: await homePage(main, route.params);
    }

    // scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  } catch (e) {
    console.error(e);
    appRoot.replaceChildren(el('div', { class: 'main wide' }, [
      el('div', { class: 'empty' }, [
        el('i', { class: 'fa-solid fa-triangle-exclamation' }),
        el('p', { text: e.message || 'Error' }),
        el('div', { style: 'margin-top:14px' }, [
          el('button', { class: 'btn primary', text: t('home'), onclick: () => navigate('home') }),
        ]),
      ]),
    ]));
  } finally {
    rendering = false;
  }
}

/* --------------------------- global handles -------------------------- */
window.__rerender = render;
window.__logout = logout;
window.__state = state;
window.__toast = toast;

/* ------------------------------- start ------------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
