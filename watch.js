/* Watch page — player, actions, channel bar, comments, up-next */
import {
  el, t, get, post, state, navigate, avatarNode, fmtNum, fmtTime, relTime,
  toast, emptyState, loadingBlock, videoCard, openCtx, openModal, closeModal, esc,
} from '../core.js';

export async function watchPage(main, params, ctx) {
  const id = Number(params.id);
  if (!id) { main.append(emptyState('fa-solid fa-video-slash', t('no_results'))); return; }

  const layout = el('div', { class: 'watch-grid' });
  main.append(layout);
  const left = el('div', { class: 'stack' });
  const right = el('div', { class: 'stack' });
  layout.append(left, right);
  left.append(loadingBlock());

  let data;
  try { data = await get(`/api/videos/${id}`); }
  catch (e) { left.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message)); return; }

  const v = data.video;
  left.replaceChildren();

  /* ------------------------------ player ---------------------------- */
  const video = el('video', {
    controls: false, playsinline: true, preload: 'metadata',
    poster: v.thumbnail || '',
    src: v.source_url || '',
  });
  const stage = el('div', { class: 'player-stage' });
  if (v.source_url) {
    stage.append(video);
  } else {
    stage.append(el('div', { class: 'placeholder' }, [
      el('i', { class: 'fa-solid fa-circle-play', style: 'font-size:52px;color:var(--accent-red)' }),
      el('b', { style: 'font-size:18px', text: v.title }),
      el('span', { class: 'dim', style: 'color:#bbb', text: v.channel_name }),
      el('span', { class: 'badge grey', text: t('no_media') }),
    ]));
  }
  if (v.is_live) stage.append(el('span', { class: 'badge live', style: 'position:absolute;top:12px;inset-inline-start:12px;z-index:3', html: '<i class="fa-solid fa-circle" style="font-size:7px"></i> &nbsp;LIVE' }));

  /* progress + controls */
  const fill = el('i', { style: 'width:0%' });
  const knob = el('b');
  const seek = el('div', { class: 'seek' });
  seek.append(fill, knob);
  const timeLabel = el('span', { class: 'time', text: '0:00 / ' + fmtTime(v.duration) });
  const playBtn = el('button', { class: 'pbtn', 'aria-label': 'play', html: '<i class="fa-solid fa-play"></i>' });
  const muteBtn = el('button', { class: 'pbtn', 'aria-label': 'mute', html: '<i class="fa-solid fa-volume-high"></i>' });
  const fsBtn = el('button', { class: 'pbtn', 'aria-label': 'fullscreen', html: '<i class="fa-solid fa-expand"></i>' });

  const vol = el('input', { type: 'range', min: '0', max: '1', step: '0.02', value: '1', class: 'vol', 'aria-label': t('quality') });

  const controls = el('div', { class: 'player-ctrl' }, [playBtn, seek, timeLabel, muteBtn, vol, fsBtn]);

  const player = el('div', { class: 'player-shell' }, [stage, controls]);
  left.append(player);

  /* wire player */
  let watched = 0;
  let viewSent = false;
  const sendView = () => {
    if (viewSent) return;
    viewSent = true;
    post(`/api/videos/${v.id}/view`, { seconds: Math.round(watched) }).catch(() => {});
  };

  if (v.source_url) {
    const sync = () => {
      const dur = video.duration || v.duration || 0;
      const cur = video.currentTime || 0;
      const pct = dur ? (cur / dur) * 100 : 0;
      fill.style.width = pct.toFixed(2) + '%';
      knob.style.insetInlineStart = pct.toFixed(2) + '%';
      timeLabel.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
    };
    video.addEventListener('timeupdate', () => { sync(); watched = video.currentTime; if (watched > 3) sendView(); });
    video.addEventListener('loadedmetadata', sync);
    video.addEventListener('play', () => { playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; });
    video.addEventListener('pause', () => { playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; sendView(); });
    video.addEventListener('ended', () => { playBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>'; sendView(); });

    playBtn.onclick = () => { video.paused ? video.play() : video.pause(); };
    muteBtn.onclick = () => {
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    };
    vol.oninput = () => { video.volume = Number(vol.value); video.muted = Number(vol.value) === 0; };
    fsBtn.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else stage.requestFullscreen && stage.requestFullscreen();
    };
    seek.onclick = (e) => {
      const rect = seek.getBoundingClientRect();
      const rtl = document.documentElement.dir === 'rtl';
      let ratio = (e.clientX - rect.left) / rect.width;
      if (rtl) ratio = 1 - ratio;
      if (video.duration) video.currentTime = Math.max(0, Math.min(1, ratio)) * video.duration;
    };
  } else {
    playBtn.onclick = () => toast(t('no_media'), 'info');
    [seek, vol].forEach((n) => n.style.opacity = '0.4');
  }

  /* ------------------------------- title ---------------------------- */
  const title = el('h1', { style: 'font-size:19px;font-weight:800;margin:0', text: v.title });
  left.append(title);

  /* --------------------------- action buttons ----------------------- */
  const myRx = new Set(data.myReactions || []);
  const mkAction = (kind, icon, label, cls) => {
    const on = myRx.has(kind);
    return el('button', {
      class: `pa-btn ${cls || ''}` + (on ? ' on' : ''),
      onclick: async (e) => {
        const b = e.currentTarget;
        try {
          const r = await post(`/api/videos/${v.id}/react`, { kind });
          b.classList.toggle('on', r.active);
        } catch (err) { toast(err.message, 'error'); }
      },
    }, [el('i', { class: icon }), el('span', { text: label })]);
  };

  const actionRow = el('div', { class: 'player-actions' }, [
    el('span', { class: 'dim', text: `${fmtNum(v.views)} ${t('views')} • ${relTime(v.created_at)}` }),
    el('span', { style: 'flex:1' }),
    mkAction('like', 'fa-solid fa-thumbs-up', `${t('like')} ${fmtNum(v.likes)}`, 'red'),
    mkAction('dislike', 'fa-solid fa-thumbs-down', t('dislike'), 'red'),
    el('button', {
      class: 'pa-btn', html: '<i class="fa-solid fa-share"></i> ' + t('share'),
      onclick: async () => {
        const url = `${location.origin}/#/watch/${v.id}`;
        try { if (navigator.share) await navigator.share({ title: v.title, url }); else { await navigator.clipboard.writeText(url); toast(t('share_link')); } }
        catch { toast(url, 'info'); }
      },
    }),
    el('button', {
      class: 'pa-btn', html: '<i class="fa-solid fa-download"></i> ' + t('download'),
      onclick: () => { if (v.source_url) window.open(v.source_url, '_blank', 'noopener'); else toast(t('no_media'), 'info'); },
    }),
    mkAction('save', 'fa-solid fa-bookmark', t('save')),
  ]);
  left.append(actionRow);

  /* --------------------------- channel bar -------------------------- */
  const isSub = !!(state.user && state.user.id !== v.user_id);
  left.append(el('div', { class: 'card row between' }, [
    el('div', { class: 'row', style: 'min-width:0' }, [
      el('div', { class: 'avatar-btn', onclick: () => navigate(`channel/${v.channel_handle}`), style: 'cursor:pointer' }, [
        avatarNode(v.channel_avatar, v.channel_name),
      ]),
      el('div', { style: 'min-width:0' }, [
        el('div', { class: 'row', style: 'gap:6px' }, [
          el('b', { text: v.channel_name, style: 'cursor:pointer', onclick: () => navigate(`channel/${v.channel_handle}`) }),
          v.channel_verified ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:#3b82f6' }) : null,
        ].filter(Boolean)),
        el('small', { class: 'dim', text: `${fmtNum(v.subscribers || 0)} ${t('subscribers')} • ${v.channel_profession || ''}` }),
      ]),
    ]),
    (state.user && state.user.id === v.user_id)
      ? el('button', { class: 'btn', onclick: () => navigate(`channel/${v.channel_handle}`), html: '<i class="fa-solid fa-pen"></i> ' + t('edit_channel') })
      : el('button', {
          class: 'btn primary',
          onclick: async (e) => {
            if (!state.user) { navigate('login'); return; }
            const b = e.currentTarget; b.disabled = true;
            try {
              const r = await post(`/api/channel/${v.channel_handle}/subscribe`);
              b.className = 'btn ' + (r.subscribed ? 'subscribed' : 'primary');
              b.textContent = r.subscribed ? t('subscribed') : t('subscribe');
            } catch (err) { toast(err.message, 'error'); }
            b.disabled = false;
          },
        }, [el('i', { class: 'fa-solid fa-bell' }), el('span', { text: t('subscribe') })]),
  ]));

  /* --------------------------- description -------------------------- */
  if (v.description) {
    left.append(el('div', { class: 'card' }, [
      el('div', { class: 'dim', text: `${fmtNum(v.views)} ${t('views')} • ${relTime(v.created_at)}` }),
      el('p', { style: 'white-space:pre-wrap;margin:10px 0 0', text: v.description }),
    ]));
  }

  /* ------------------------------ comments -------------------------- */
  const comments = el('div', { class: 'stack' });
  left.append(el('div', { class: 'card' }, [
    el('h3', { class: 'section-title', text: `${t('comments')} (${data.comments.length})` }),
    state.user
      ? el('div', { class: 'field' }, [
          el('textarea', { class: 'input', rows: 2, placeholder: t('add_comment'), id: 'new-comment' }),
          el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:8px' }, [
            el('button', {
              class: 'btn primary', html: '<i class="fa-solid fa-paper-plane"></i> ' + t('comment'),
              onclick: async (e) => {
                const ta = document.getElementById('new-comment');
                if (!ta.value.trim()) return;
                e.currentTarget.disabled = true;
                try {
                  await post(`/api/videos/${v.id}/comments`, { body: ta.value.trim() });
                  ta.value = '';
                  toast(t('comment'));
                  const fresh = await get(`/api/videos/${v.id}`);
                  data.comments = fresh.comments;
                  paintComments();
                } catch (err) { toast(err.message, 'error'); }
                e.currentTarget.disabled = false;
              },
            }),
          ]),
        ])
      : el('button', { class: 'btn', text: t('login'), onclick: () => navigate('login') }),
    comments,
  ]));

  function paintComments() {
    comments.replaceChildren();
    if (!data.comments.length) { comments.append(el('p', { class: 'dim', text: t('no_comments') })); return; }
    for (const cm of data.comments) {
      comments.append(el('div', { class: 'row', style: 'align-items:flex-start;gap:12px;margin-top:14px' }, [
        el('div', { class: 'avatar-btn', style: 'flex-shrink:0' }, [avatarNode(cm.avatar, cm.full_name)]),
        el('div', { style: 'min-width:0;flex:1' }, [
          el('div', { class: 'row', style: 'gap:6px' }, [
            el('b', { style: 'font-size:13.5px', text: cm.full_name }),
            cm.is_verified ? el('i', { class: 'fa-solid fa-circle-check', style: 'color:#3b82f6;font-size:12px' }) : null,
            el('span', { class: 'dim', text: relTime(cm.created_at) }),
          ].filter(Boolean)),
          el('div', { style: 'white-space:pre-wrap', text: cm.body }),
          el('button', {
            class: 'btn sm ghost', style: 'margin-top:4px',
            onclick: (e) => openCtx(e.clientX, e.clientY, [
              { label: t('report'), icon: 'fa-solid fa-flag', danger: true, onClick: () => reportTarget('comment', cm.id) },
            ]),
            html: '<i class="fa-solid fa-ellipsis"></i>',
          }),
        ]),
      ]));
    }
  }
  paintComments();

  /* ------------------------------ up next --------------------------- */
  right.append(loadingBlock());
  try {
    const feed = await get('/api/feed?limit=14');
    const list = feed.videos.filter((x) => x.id !== v.id).slice(0, 12);
    right.replaceChildren(el('h3', { class: 'section-title', text: t('recommended') }));
    if (!list.length) right.append(el('p', { class: 'dim', text: t('no_results') }));
    list.forEach((x) => right.append(el('div', { class: 'row', style: 'gap:10px;cursor:pointer', onclick: () => navigate(`watch/${x.id}`) }, [
      el('div', { class: 'thumb', style: 'width:150px;aspect-ratio:16/9;flex-shrink:0' }, [
        x.thumbnail ? el('img', { src: x.thumbnail, alt: x.title }) : el('div', { style: 'display:grid;place-items:center;height:100%;color:var(--text-dim)', html: '<i class="fa-solid fa-film"></i>' }),
        x.duration ? el('span', { class: 'dur', text: fmtTime(x.duration) }) : null,
      ].filter(Boolean)),
      el('div', { style: 'min-width:0' }, [
        el('b', { style: 'font-size:13.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden', text: x.title }),
        el('div', { class: 'dim', text: x.channel_name }),
        el('div', { class: 'dim', text: `${fmtNum(x.views)} ${t('views')} • ${relTime(x.created_at)}` }),
      ]),
    ])));
  } catch (e) {
    right.replaceChildren(emptyState('fa-solid fa-triangle-exclamation', e.message));
  }
}

export function reportTarget(type, id) {
  const ta = el('textarea', { class: 'input', rows: 3, placeholder: t('report_reason') });
  openModal({
    title: t('report'),
    body: ta,
    footer: [
      el('button', { class: 'btn', text: t('cancel'), onclick: closeModal }),
      el('button', {
        class: 'btn primary', text: t('confirm'),
        onclick: async () => {
          try { await post('/api/admin/reports', { target_type: type, target_id: id, reason: ta.value }); toast(t('report')); }
          catch (err) { toast(err.message, 'error'); }
          closeModal();
        },
      }),
    ],
  });
}
