/* Shorts — TikTok-style vertical, snap-scrolling, autoplay feed */
import {
  el, t, get, post, state, navigate, avatarNode, fmtNum, toast, emptyState, loadingBlock,
} from '../core.js';

let observer = null;
const listened = new WeakSet();

export async function shortsPage(main) {
  if (observer) { observer.disconnect(); observer = null; }

  const wrap = el('div', { class: 'shorts-wrap' });
  main.append(wrap);
  wrap.append(loadingBlock());

  let shorts = [];
  try {
    const data = await get('/api/shorts');
    shorts = data.shorts || [];
  } catch (e) {
    wrap.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
    return;
  }
  if (!shorts.length) { wrap.replaceChildren(emptyState('fa-solid fa-bolt', t('no_shorts'))); return; }

  const feed = el('div', { class: 'shorts-feed', id: 'shorts-feed' });
  shorts.forEach((v, i) => feed.append(shortSlide(v, i)));
  wrap.replaceChildren(feed);

  const slides = Array.from(feed.children);

  // Autoplay: play the slide fully in view, pause the rest.
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const media = entry.target.querySelector('video');
      if (!media) continue;
      if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
        media.play().catch(() => {});
        post(`/api/videos/${entry.target.dataset.id}/view`, { seconds: 4 }).catch(() => {});
      } else {
        media.pause();
      }
    }
  }, { root: feed, threshold: [0, 0.55, 0.9] });
  slides.forEach((s) => observer.observe(s));

  // Keyboard up/down navigation
  const keyNav = (e) => {
    if (state.route.name !== 'shorts') { document.removeEventListener('keydown', keyNav); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'j' && e.key !== 'k') return;
    const cur = slides.findIndex((s) => s.getBoundingClientRect().top >= -10);
    const next = Math.max(0, Math.min(slides.length - 1, cur + (e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1)));
    if (next !== cur) { slides[next].scrollIntoView({ behavior: 'smooth' }); e.preventDefault(); }
  };
  document.addEventListener('keydown', keyNav);
}

function shortSlide(v, index) {
  const media = v.source_url
    ? el('video', {
        class: 'short-media', src: v.source_url, loop: true, muted: true,
        playsinline: true, preload: index < 2 ? 'auto' : 'none', poster: v.thumbnail || '',
        onclick: (e) => { const m = e.currentTarget; m.paused ? m.play().catch(() => {}) : m.pause(); },
      })
    : el('div', {
        class: 'short-media',
        style: 'display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,rgba(255,0,0,.35),transparent 60%),radial-gradient(circle at 70% 80%,rgba(16,185,129,.3),transparent 60%),#000',
      }, [
        el('div', { style: 'text-align:center;color:#fff;padding:20px' }, [
          el('i', { class: 'fa-solid fa-bolt', style: 'font-size:44px;color:var(--accent-green)' }),
          el('p', { style: 'font-weight:800;margin:10px 0 4px', text: v.title }),
          el('span', { class: 'dim', style: 'color:#bbb', text: v.channel_name }),
        ]),
      ]);

  let liked = false;
  const heart = el('button', { class: 'rail-btn', 'aria-label': 'like' }, [
    el('i', { class: 'fa-solid fa-heart' }),
    el('small', { text: fmtNum(v.likes || 0) }),
  ]);
  heart.onclick = async () => {
    if (!state.user) { navigate('login'); return; }
    try {
      const r = await post(`/api/videos/${v.id}/react`, { kind: 'like' });
      liked = r.active;
      heart.classList.toggle('liked', liked);
      const n = Math.max(0, (v.likes || 0) + (liked ? 1 : 0) - (!liked ? 1 : 0));
      heart.querySelector('small').textContent = fmtNum(n);
    } catch (e) { toast(e.message, 'error'); }
  };

  const rail = el('div', { class: 'short-rail' }, [
    el('div', { class: 'rail-avatar', onclick: () => navigate(`channel/${v.channel_handle}`) }, [avatarNode(v.channel_avatar, v.channel_name)]),
    heart,
    el('button', {
      class: 'rail-btn', 'aria-label': 'comments',
      onclick: () => showShortComments(v),
    }, [el('i', { class: 'fa-solid fa-comment-dots' }), el('small', { text: t('comments') })]),
    el('button', {
      class: 'rail-btn', 'aria-label': 'share',
      onclick: async () => {
        const url = `${location.origin}/#/watch/${v.id}`;
        try { if (navigator.share) await navigator.share({ title: v.title, url }); else { await navigator.clipboard.writeText(url); toast(t('share_link')); } }
        catch { toast(url, 'info'); }
      },
    }, [el('i', { class: 'fa-solid fa-share' }), el('small', { text: t('share') })]),
    el('button', {
      class: 'rail-btn', 'aria-label': 'save',
      onclick: async () => {
        if (!state.user) { navigate('login'); return; }
        try { await post(`/api/videos/${v.id}/react`, { kind: 'save' }); toast(t('save')); } catch (e) { toast(e.message, 'error'); }
      },
    }, [el('i', { class: 'fa-solid fa-bookmark' }), el('small', { text: t('save') })]),
    el('div', { class: 'disc' }, [el('i', { class: 'fa-solid fa-compact-disc' })]),
  ]);

  const caption = el('div', { class: 'short-caption' }, [
    el('div', { class: 'row', style: 'gap:8px;margin-bottom:8px' }, [
      el('b', { style: 'color:#fff', text: '@' + v.channel_handle }),
      v.channel_verified ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:#60a5fa' }) : null,
    ].filter(Boolean)),
    el('p', { style: 'margin:0;font-weight:600;color:#fff', text: v.title }),
    el('div', { class: 'dim', style: 'color:#ccc;margin-top:6px', text: `${fmtNum(v.views)} ${t('views')}` }),
  ]);

  return el('section', { class: 'short-slide', dataset: { id: v.id } }, [
    media, el('div', { class: 'short-overlay' }), caption, rail,
  ]);
}

async function showShortComments(v) {
  const { openModal, closeModal } = await import('../core.js');
  const box = el('div', { class: 'stack', id: 'short-comments' }, [loadingBlock()]);
  openModal({ title: `${t('comments')} — ${v.title}`, body: box });
  try {
    const data = await get(`/api/videos/${v.id}/comments`);
    box.replaceChildren();
    if (!data.comments.length) { box.append(el('p', { class: 'dim', text: t('no_comments') })); }
    data.comments.forEach((c) => box.append(el('div', { class: 'row', style: 'gap:10px;align-items:flex-start' }, [
      el('div', { class: 'avatar-btn', style: 'width:32px;height:32px;font-size:12px' }, [avatarNode(c.avatar, c.full_name)]),
      el('div', {}, [
        el('b', { style: 'font-size:13px', text: c.full_name }),
        el('div', { style: 'font-size:13.5px', text: c.body }),
      ]),
    ])));
  } catch (e) {
    box.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}
