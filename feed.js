/* Home / trending feed */
import { el, t, get, videoCard, emptyState, loadingBlock, state, navigate, fmtNum, adBanner } from '../core.js';

export async function homePage(main, params) {
  const q = params.q || '';
  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-house accent' }),
    el('span', { text: q ? `${t('search')}: ${q}` : t('home') }),
  ]));

  // Admin custom ad slot — renders only when the admin enabled ads and
  // configured a unit. Otherwise it is silently skipped (no error).
  try {
    const ad = await adBanner();
    if (ad) main.append(ad);
  } catch { /* never let an ad break the feed */ }

  const holder = el('div', { class: 'grid videos' });
  main.append(holder, el('div', { class: 'spacer-6' }));

  try {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    query.set('limit', '30');
    const data = await get('/api/feed?' + query.toString());
    holder.replaceChildren();

    if (q) {
      if (!data.videos.length) holder.append(emptyState('fa-solid fa-magnifying-glass', t('no_results')));
      else data.videos.forEach((v) => holder.append(videoCard(v)));
      return;
    }

    // Trending strip
    if (data.trending && data.trending.length) {
      const trend = el('section', { class: 'card' }, [
        el('h2', { class: 'section-title' }, [el('i', { class: 'fa-solid fa-fire' }), el('span', { text: t('trending') })]),
        el('div', { class: 'grid videos' }, data.trending.slice(0, 4).map(videoCard)),
      ]);
      main.insertBefore(trend, holder);
      main.insertBefore(el('div', { class: 'spacer-6' }), holder);
    }

    if (!data.videos.length) {
      holder.replaceChildren(emptyState('fa-solid fa-video', t('no_videos')));
    } else {
      data.videos.forEach((v) => holder.append(videoCard(v)));
    }
  } catch (e) {
    holder.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}

export async function trendingPage(main) {
  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-fire', style: 'color:var(--accent-red)' }),
    el('span', { text: t('trending') }),
  ]));
  const holder = el('div', { class: 'grid videos' });
  main.append(holder);
  try {
    const data = await get('/api/feed?limit=60');
    const sorted = [...data.videos].sort((a, b) => (b.views || 0) - (a.views || 0));
    if (!sorted.length) holder.append(emptyState('fa-solid fa-fire', t('no_videos')));
    else sorted.forEach((v) => holder.append(videoCard(v)));
  } catch (e) {
    holder.append(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}

export async function livePage(main) {
  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-tower-broadcast', style: 'color:var(--accent-red)' }),
    el('span', { text: t('live') }),
  ]));
  const holder = el('div', { class: 'grid videos' });
  main.append(holder);
  try {
    const data = await get('/api/live');
    if (!data.live.length) holder.append(emptyState('fa-solid fa-satellite-dish', t('no_live')));
    else data.live.forEach((v) => holder.append(videoCard(v)));
  } catch (e) {
    holder.append(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}

export async function playlistsPage(main) {
  const user = state.user;
  main.append(el('div', { class: 'section-title' }, [
    el('i', { class: 'fa-solid fa-list' }),
    el('span', { text: t('playlists') }),
  ]));
  if (!user) {
    main.append(emptyState('fa-solid fa-lock', t('login_required')));
    main.append(el('div', { class: 'row', style: 'justify-content:center' }, [
      el('button', { class: 'btn primary', text: t('login'), onclick: () => navigate('login') }),
    ]));
    return;
  }
  try {
    const data = await get(`/api/channel/${user.handle}`);
    if (!data.playlists.length) {
      main.append(emptyState('fa-solid fa-list', t('no_results')));
      return;
    }
    main.append(el('div', { class: 'grid videos' }, data.playlists.map((p) => el('div', { class: 'card' }, [
      el('h4', { style: 'margin:0', text: p.title }),
      el('div', { class: 'dim', style: 'margin-top:6px', text: rel(p.created_at) }),
    ]))));
  } catch (e) {
    main.append(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}

function rel(iso) {
  const d = new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T') + 'Z');
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '';
}
